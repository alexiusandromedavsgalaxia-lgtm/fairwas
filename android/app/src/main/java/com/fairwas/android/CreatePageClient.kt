package com.fairwas.android

import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** Native client for Fairwas CreatePage's existing project API. */
class CreatePageClient(baseUrl: String) {
    private val endpoint = baseUrl.trimEnd('/') + "/api/createpage"

    fun listSites(): JSONArray = request("sites", null).optJSONArray("items") ?: JSONArray()
    fun registerDeveloper(displayName: String, email: String): JSONObject =
        request("developer", JSONObject().put("display_name", displayName).put("email", email))
    fun createSite(hostname: String, title: String, html: String): JSONObject {
        val files = JSONArray().put(JSONObject().put("path", "/index.html").put("content", html).put("content_type", "text/html; charset=utf-8"))
        return request("create", JSONObject().put("hostname", hostname).put("title", title).put("files", files))
    }
    fun unpublish(siteId: String): JSONObject = request("unpublish", JSONObject().put("site_id", siteId))
    fun deleteSite(siteId: String): JSONObject = request("delete-site", JSONObject().put("site_id", siteId))

    private fun request(action: String, body: JSONObject?): JSONObject {
        val url = URL("$endpoint?action=$action")
        val connection = url.openConnection() as HttpURLConnection
        connection.connectTimeout = 12_000
        connection.readTimeout = 20_000
        connection.requestMethod = if (body == null) "GET" else "POST"
        connection.setRequestProperty("Accept", "application/json")
        if (body != null) {
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
        }
        try {
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val result = JSONObject(stream.bufferedReader().use { it.readText() })
            if (!result.optBoolean("ok")) {
                throw IllegalStateException(result.optString("detail", result.optString("error", "Error de CreatePage")))
            }
            return result
        } finally { connection.disconnect() }
    }
}
