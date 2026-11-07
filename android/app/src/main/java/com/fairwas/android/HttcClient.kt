package com.fairwas.android

import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import org.json.JSONObject
import java.io.FilterInputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.net.URLEncoder

/** Kotlin client for the existing Fairwas HTTC resolver. */
class HttcClient(baseUrl: String) {
    private val base = baseUrl.trimEnd('/').also {
        require(it.startsWith("https://", true)) {
            "FAIRWAS_BASE_URL debe usar HTTPS."
        }
    }

    fun normalize(input: String): String {
        val value = input.trim()
        require(value.isNotEmpty()) { "Introduce una dirección" }

        val candidate = when {
            value.startsWith("httc://", true) -> "httc://" + value.substringAfter("://")
            value.startsWith("http://", true) -> "httc://" + value.substringAfter("://")
            value.startsWith("https://", true) -> "httc://" + value.substringAfter("://")
            else -> "httc://$value"
        }

        // URI.host rejects underscores even though Fairwas hostnames allow them.
        // Validate the authority explicitly so Android accepts the same host syntax as the web app.
        val parsed = URI(candidate.replace(" ", "%20"))
        val authority = parsed.rawAuthority.orEmpty()
        require(parsed.scheme.equals("httc", ignoreCase = true) && authority.isNotBlank()) {
            "Dirección HTTC no válida."
        }
        require(!authority.contains("@")) {
            "No se permiten credenciales dentro de la dirección."
        }

        val closingBracket = if (authority.startsWith("[")) authority.indexOf(']') else -1
        val host: String
        val portText: String?
        if (closingBracket >= 0) {
            require(closingBracket > 1) { "Dirección HTTC no válida." }
            host = authority.substring(1, closingBracket)
            val suffix = authority.substring(closingBracket + 1)
            portText = if (suffix.isEmpty()) null else suffix.removePrefix(":").takeIf {
                suffix.startsWith(":") && it.isNotEmpty()
            }
            require(suffix.isEmpty() || portText != null) { "Dirección HTTC no válida." }
        } else {
            val hasPort = authority.matches(Regex("^.+:\\d+$"))
            host = if (hasPort) authority.substringBeforeLast(":") else authority
            portText = if (hasPort) authority.substringAfterLast(":") else null
        }

        val hostnamePattern = Regex("^[A-Za-z0-9_](?:[A-Za-z0-9_-]{0,61}[A-Za-z0-9_])?(?:\\.[A-Za-z0-9_](?:[A-Za-z0-9_-]{0,61}[A-Za-z0-9_])?)*$")
        val validIpv6 = closingBracket >= 0 && parsed.host != null
        require(host.isNotBlank() && (hostnamePattern.matches(host) || validIpv6)) {
            "Dirección HTTC no válida."
        }
        if (portText != null) {
            val port = portText.toIntOrNull()
            require(port != null && port in 0..65535) { "Puerto HTTC no válido." }
        }
        return parsed.toASCIIString()
    }

    fun resolve(address: String): ResolvedPage {
        val target = normalize(address)
        val connection = URL("$base/api/resolve?url=" + enc(target)).openConnection() as HttpURLConnection
        connection.connectTimeout = 12_000
        connection.readTimeout = 15_000
        connection.setRequestProperty("Accept", "application/json")
        try {
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
                ?: throw IllegalStateException("El servidor respondió HTTP $code sin contenido.")
            val json = JSONObject(stream.bufferedReader(Charsets.UTF_8).use { it.readText() })
            if (code !in 200..299 || !json.optBoolean("ok")) {
                throw IllegalStateException(
                    json.optString("detail").takeIf { it.isNotBlank() }
                        ?: json.optString("error").takeIf { it.isNotBlank() }
                        ?: "No se pudo resolver HTTC (HTTP $code)."
                )
            }
            val document = json.optJSONObject("document")
            val type = document?.optString("type").orEmpty()
            val html = when (type) {
                "site" -> document?.optJSONObject("runtime")?.optString("html").orEmpty()
                "api" -> {
                    val body = document?.optString("body").orEmpty()
                    if (document?.optString("contentType")?.contains("html", true) == true) body
                    else "<!doctype html><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Fairwas API</title><pre style='white-space:pre-wrap;overflow-wrap:anywhere;font:14px monospace;padding:16px'>${escapeHtml(body)}</pre>"
                }
                else -> ""
            }
            if (html.isBlank()) throw IllegalStateException("El servidor no devolvió una página HTML compatible.")
            return ResolvedPage(target, html)
        } finally {
            connection.disconnect()
        }
    }

    /**
     * Proxies GET resources for HTTC virtual hosts. Android's WebResourceRequest
     * does not expose the request body, so non-GET methods cannot be forwarded safely.
     */
    fun intercept(request: WebResourceRequest): WebResourceResponse? {
        val uri = request.url
        val virtualHost = uri.host ?: return null
        if (!virtualHost.endsWith(".httc.local", ignoreCase = true)) return null

        if (!request.method.equals("GET", ignoreCase = true)) {
            return WebResourceResponse(
                "text/plain",
                "UTF-8",
                405,
                "Method Not Allowed",
                mapOf("Allow" to "GET"),
                "Este recurso HTTC no admite este método desde el navegador Android.".byteInputStream()
            )
        }

        val path = uri.encodedPath ?: "/"
        return try {
            // Top-level navigation inside a published site must be resolved as
            // a document, not as a static asset. This is what lets Android WebView
            // load client-side routes such as /illustratin on refresh and link clicks.
            if (request.isForMainFrame) {
                val host = virtualHost.removeSuffix(".httc.local")
                val target = "httc://$host$path" + (uri.encodedQuery?.let { "?$it" } ?: "")
                val page = resolve(target)
                return WebResourceResponse(
                    "text/html",
                    "UTF-8",
                    200,
                    "OK",
                    mapOf("Cache-Control" to "no-store"),
                    page.html.byteInputStream(Charsets.UTF_8)
                )
            }
            val endpoint = if (path == "/api/resolve" || path == "/api/proxy" || path == "/api/createpage") {
                base + path + (uri.encodedQuery?.let { "?$it" } ?: "")
            } else {
                val host = virtualHost.removeSuffix(".httc.local")
                val target = "httc://$host$path" + (uri.encodedQuery?.let { "?$it" } ?: "")
                "$base/api/resolve?url=${enc(target)}&asset=${enc(path)}"
            }
            val connection = URL(endpoint).openConnection() as HttpURLConnection
            connection.connectTimeout = 10_000
            connection.readTimeout = 20_000
            connection.requestMethod = "GET"
            val code = connection.responseCode
            val contentType = connection.contentType ?: "application/octet-stream"
            val mime = contentType.substringBefore(';').trim().ifBlank { "application/octet-stream" }
            val isText = mime.startsWith("text/") ||
                mime.contains("json") ||
                mime.contains("javascript") ||
                mime.contains("xml") ||
                mime == "image/svg+xml"
            val charset = Regex("charset=([^;]+)", RegexOption.IGNORE_CASE)
                .find(contentType)?.groupValues?.getOrNull(1)?.trim()?.trim('"')
            val encoding = if (isText) charset ?: "UTF-8" else null
            val source = if (code in 200..299) connection.inputStream else connection.errorStream
                ?: ByteArray(0).inputStream()
            val managedStream = object : FilterInputStream(source) {
                override fun close() {
                    try {
                        super.close()
                    } finally {
                        connection.disconnect()
                    }
                }
            }
            WebResourceResponse(
                mime,
                encoding,
                code,
                connection.responseMessage ?: "OK",
                mapOf("Access-Control-Allow-Origin" to "*"),
                managedStream
            )
        } catch (_: Exception) {
            null
        }
    }

    private fun enc(value: String) = URLEncoder.encode(value, Charsets.UTF_8.name())

    private fun escapeHtml(value: String) = value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        .replace("\"", "&quot;").replace("'", "&#39;")
}

data class ResolvedPage(val address: String, val html: String)
