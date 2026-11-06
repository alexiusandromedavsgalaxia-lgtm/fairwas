package com.fairwas.android

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import java.util.concurrent.Executors

/** Simple native CreatePage dashboard for developer registration and site publishing. */
class CreatePageActivity : Activity() {
    private val worker = Executors.newSingleThreadExecutor()
    private lateinit var api: CreatePageClient
    private lateinit var content: LinearLayout
    private lateinit var nameField: EditText
    private lateinit var emailField: EditText
    private lateinit var hostField: EditText
    private lateinit var titleField: EditText

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        api = CreatePageClient(BuildConfig.FAIRWAS_BASE_URL)
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(18, 18, 18, 18); setBackgroundColor(Color.rgb(14, 16, 22)) }
        root.addView(TextView(this).apply { text = "CreatePage"; textSize = 26f; setTextColor(Color.WHITE) })
        root.addView(TextView(this).apply { text = "Gestiona y publica sitios HTTC"; setTextColor(Color.LTGRAY) })
        nameField = field("Nombre de desarrollador")
        emailField = field("Correo electrónico")
        root.addView(nameField); root.addView(emailField)
        root.addView(button("Registrar desarrollador") { runRequest { api.registerDeveloper(nameField.text.toString(), emailField.text.toString()) } })
        root.addView(TextView(this).apply { text = "Nuevo sitio"; textSize = 20f; setTextColor(Color.WHITE); setPadding(0, 18, 0, 4) })
        hostField = field("dominio.fair")
        titleField = field("Nombre del sitio")
        root.addView(hostField); root.addView(titleField)
        root.addView(button("Crear sitio HTTC") {
            val host = hostField.text.toString().trim()
            val title = titleField.text.toString().trim().ifBlank { host }
            val safeTitle = escapeHtml(title)
            val html = "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width'><title>" + safeTitle + "</title></head><body><main><h1>" + safeTitle + "</h1><p>Publicado con Fairwas para Android.</p></main></body></html>"
            runRequest { api.createSite(host, title, html) }
        })
        root.addView(button("Actualizar lista") { refreshSites() })
        val scroll = ScrollView(this)
        content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        scroll.addView(content)
        root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        root.addView(button("Volver al navegador") { finish() })
        setContentView(root)
        refreshSites()
    }

    private fun field(hintText: String) = EditText(this).apply {
        hint = hintText; setSingleLine(true); setTextColor(Color.WHITE); setHintTextColor(Color.LTGRAY)
    }

    private fun button(label: String, action: () -> Unit) = Button(this).apply {
        text = label; isAllCaps = false; setOnClickListener { action() }
    }

    private fun runRequest(action: () -> org.json.JSONObject) {
        worker.execute {
            try {
                val result = action()
                runOnUiThread { toast("Operación completada"); refreshSites() }
            } catch (e: Exception) { runOnUiThread { toast(e.message ?: "Error de CreatePage") } }
        }
    }

    private fun refreshSites() {
        worker.execute {
            try {
                val sites = api.listSites()
                runOnUiThread {
                    content.removeAllViews()
                    for (i in 0 until sites.length()) {
                        val site = sites.getJSONObject(i)
                        val host = site.optString("hostname")
                        val title = site.optString("title", host)
                        val status = site.optString("status")
                        val card = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(12, 12, 12, 12); setBackgroundColor(Color.rgb(34, 38, 47)) }
                        card.addView(TextView(this).apply { text = title; textSize = 18f; setTextColor(Color.WHITE) })
                        card.addView(TextView(this).apply { text = "httc://$host · $status"; setTextColor(Color.LTGRAY) })
                        content.addView(card)
                    }
                    if (sites.length() == 0) content.addView(TextView(this).apply { text = "Todavía no hay sitios."; setTextColor(Color.LTGRAY) })
                }
            } catch (e: Exception) { runOnUiThread { toast(e.message ?: "No se pudieron cargar los sitios") } }
        }
    }

    private fun escapeHtml(value: String): String = value
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&#39;")

    private fun toast(message: String) = Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    override fun onDestroy() { worker.shutdownNow(); super.onDestroy() }
}
