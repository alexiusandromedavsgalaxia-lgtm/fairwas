package com.fairwas.android

import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/** Kotlin client for the existing Fairwas HTTC resolver. */
class HttcClient(private val baseUrl: String) {
    private val base = baseUrl.trimEnd('/')

    fun normalize(input: String): String {
        val value = input.trim()
        require(value.isNotEmpty()) { "Introduce una dirección" }
        if (value.startsWith("httc://", true)) return value
        if (value.startsWith("http://", true) || value.startsWith("https://", true)) {
            val parsed = URL(value)
            return "httc://" + parsed.host + parsed.file
        }
        return "httc://$value"
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
            val json = JSONObject(stream.bufferedReader().use { it.readText() })
            if (!json.optBoolean("ok")) {
                throw IllegalStateException(json.optString("detail", json.optString("error", "No se pudo resolver HTTC")))
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
        } finally { connection.disconnect() }
    }

    /** Forward published-site asset requests to the same resolver used by the web browser. */
    fun intercept(request: WebResourceRequest): WebResourceResponse? {
        val uri = request.url
        val virtualHost = uri.host ?: return null
        if (!virtualHost.endsWith(".httc.local")) return null
        val host = virtualHost.removeSuffix(".httc.local")
        val path = uri.encodedPath ?: "/"
        val target = "httc://$host$path" + (uri.encodedQuery?.let { "?$it" } ?: "")
        return try {
            val endpoint = "$base/api/resolve?url=${enc(target)}&asset=${enc(path)}"
            val connection = URL(endpoint).openConnection() as HttpURLConnection
            connection.connectTimeout = 10_000
            connection.readTimeout = 15_000
            val code = connection.responseCode
            val mime = connection.contentType?.substringBefore(';') ?: "application/octet-stream"
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            WebResourceResponse(mime, "UTF-8", code, connection.responseMessage, mapOf("Access-Control-Allow-Origin" to "*"), stream)
        } catch (_: Exception) { null }
    }

    private fun enc(value: String) = URLEncoder.encode(value, Charsets.UTF_8.name())
    private fun escapeHtml(value: String) = value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        .replace("\"", "&quot;").replace("'", "&#39;")
}
data class ResolvedPage(val address: String, val html: String)
