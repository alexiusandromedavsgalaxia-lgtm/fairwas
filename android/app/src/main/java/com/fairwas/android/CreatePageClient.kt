package com.fairwas.android

import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** Native client for Fairwas CreatePage's existing project API. */
class CreatePageClient(baseUrl: String) {
    private val endpoint = baseUrl.trimEnd('/') + "/api/createpage"

    fun listSites(): JSONArray = request("sites", null).optJSONArray("items") ?: JSONArray()

    fun registerDeveloper(displayName: String, email: String): JSONObject {
        require(displayName.isNotBlank()) { "Introduce el nombre del desarrollador." }
        require(email.isNotBlank()) { "Introduce el correo electrónico." }
        return request(
            "developer",
            JSONObject().put("display_name", displayName.trim()).put("email", email.trim())
        )
    }

    fun createSite(hostname: String, title: String, html: String): JSONObject {
        require(hostname.isNotBlank()) { "Introduce un dominio." }
        require(title.isNotBlank()) { "Introduce el nombre del sitio." }
        require(html.isNotBlank()) { "El contenido HTML no puede estar vacío." }
        val files = JSONArray().put(
            JSONObject()
                .put("path", "/index.html")
                .put("content", html)
                .put("content_type", "text/html; charset=utf-8")
        )
        return request(
            "create",
            JSONObject().put("hostname", hostname).put("title", title).put("files", files)
        )
    }

    fun unpublish(siteId: String): JSONObject {
        require(siteId.isNotBlank()) { "Falta el identificador del sitio." }
        return request("unpublish", JSONObject().put("site_id", siteId))
    }

    fun deleteSite(siteId: String): JSONObject {
        require(siteId.isNotBlank()) { "Falta el identificador del sitio." }
        return request("delete-site", JSONObject().put("site_id", siteId))
    }

    private fun request(action: String, body: JSONObject?): JSONObject {
        val url = URL("$endpoint?action=$action")
        val connection = (url.openConnection() as HttpURLConnection).apply {
            connectTimeout = 12_000
            readTimeout = 20_000
            requestMethod = if (body == null) "GET" else "POST"
            setRequestProperty("Accept", "application/json")
        }

        try {
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.outputStream.use {
                    it.write(body.toString().toByteArray(Charsets.UTF_8))
                }
            }

            val code = connection.responseCode
            val stream = if (code in 200..299) {
                connection.inputStream
            } else {
                connection.errorStream
                    ?: throw IllegalStateException("CreatePage respondió HTTP $code sin detalles.")
            }
            val responseText = stream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            val result = try {
                JSONObject(responseText)
            } catch (_: Exception) {
                throw IllegalStateException("Respuesta no válida del servidor (HTTP $code).")
            }

            if (code !in 200..299 || !result.optBoolean("ok")) {
                throw IllegalStateException(
                    result.optString("detail").takeIf { it.isNotBlank() }
                        ?: result.optString("error").takeIf { it.isNotBlank() }
                        ?: "Error de CreatePage (HTTP $code)."
                )
            }
            return result
        } finally {
            connection.disconnect()
        }
    }
}
