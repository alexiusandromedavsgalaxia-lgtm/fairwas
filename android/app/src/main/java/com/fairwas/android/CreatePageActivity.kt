package com.fairwas.android

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.util.Patterns
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import org.json.JSONObject
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
        WindowCompat.setDecorFitsSystemWindows(window, false)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(18, 18, 18, 18)
            setBackgroundColor(Color.rgb(14, 16, 22))
        }
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(18 + bars.left, 18 + bars.top, 18 + bars.right, 18 + bars.bottom)
            insets
        }

        root.addView(TextView(this).apply {
            text = "CreatePage"
            textSize = 26f
            setTextColor(Color.WHITE)
        })
        root.addView(TextView(this).apply {
            text = "Gestiona y publica sitios HTTC"
            setTextColor(Color.LTGRAY)
        })

        nameField = field("Nombre de desarrollador")
        emailField = field("Correo electrónico")
        root.addView(nameField)
        root.addView(emailField)
        root.addView(button("Registrar desarrollador") {
            val name = nameField.text.toString().trim()
            val email = emailField.text.toString().trim()
            if (name.isBlank()) {
                toast("Introduce el nombre del desarrollador")
            } else if (!Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
                toast("Introduce un correo electrónico válido")
            } else {
                runRequest { api.registerDeveloper(name, email) }
            }
        })

        root.addView(TextView(this).apply {
            text = "Nuevo sitio"
            textSize = 20f
            setTextColor(Color.WHITE)
            setPadding(0, 18, 0, 4)
        })
        hostField = field("dominio.fair")
        titleField = field("Nombre del sitio")
        root.addView(hostField)
        root.addView(titleField)
        root.addView(button("Crear sitio HTTC") {
            val host = hostField.text.toString().trim().lowercase()
            val title = titleField.text.toString().trim().ifBlank { host }
            if (!isValidHostname(host)) {
                toast("Introduce un dominio válido, por ejemplo sitio.fair")
            } else {
                val safeTitle = escapeHtml(title)
                val html = "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width'><title>$safeTitle</title></head><body><main><h1>$safeTitle</h1><p>Publicado con Fairwas para Android.</p></main></body></html>"
                runRequest { api.createSite(host, title, html) }
            }
        })
        root.addView(button("Actualizar lista") { refreshSites() })

        val scroll = ScrollView(this)
        content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        scroll.addView(content)
        root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        root.addView(button("Volver al navegador") { finish() })
        setContentView(root)
        ViewCompat.requestApplyInsets(root)
        refreshSites()
    }

    private fun isValidHostname(host: String): Boolean {
        if (host.isBlank() || host.length > 253 || host.startsWith('.') || host.endsWith('.')) return false
        return host.split('.').all { label ->
            label.isNotBlank() && label.length <= 63 &&
                label.first().isLetterOrDigit() && label.last().isLetterOrDigit() &&
                label.all { it.isLetterOrDigit() || it == '-' }
        }
    }

    private fun field(hintText: String) = EditText(this).apply {
        hint = hintText
        setSingleLine(true)
        setTextColor(Color.WHITE)
        setHintTextColor(Color.LTGRAY)
    }

    private fun button(label: String, action: () -> Unit) = Button(this).apply {
        text = label
        isAllCaps = false
        setOnClickListener { action() }
    }

    private fun runRequest(action: () -> JSONObject) {
        worker.execute {
            try {
                action()
                runOnUiThread {
                    if (!isFinishing && !isDestroyed) {
                        toast("Operación completada")
                        refreshSites()
                    }
                }
            } catch (e: Exception) {
                runOnUiThread {
                    if (!isFinishing && !isDestroyed) toast(e.message ?: "Error de CreatePage")
                }
            }
        }
    }

    private fun refreshSites() {
        if (!::content.isInitialized || isFinishing || isDestroyed) return
        worker.execute {
            try {
                val sites = api.listSites()
                val siteItems = (0 until sites.length()).map { sites.getJSONObject(it) }
                runOnUiThread {
                    if (isFinishing || isDestroyed) return@runOnUiThread
                    content.removeAllViews()
                    siteItems.forEach { site ->
                        val host = site.optString("hostname")
                        val title = site.optString("title").ifBlank { host }
                        val status = site.optString("status")
                        val card = LinearLayout(this).apply {
                            orientation = LinearLayout.VERTICAL
                            setPadding(12, 12, 12, 12)
                            setBackgroundColor(Color.rgb(34, 38, 47))
                        }
                        card.addView(TextView(this).apply {
                            text = title
                            textSize = 18f
                            setTextColor(Color.WHITE)
                        })
                        card.addView(TextView(this).apply {
                            text = "httc://$host · $status"
                            setTextColor(Color.LTGRAY)
                        })
                        content.addView(card)
                    }
                    if (siteItems.isEmpty()) content.addView(TextView(this).apply {
                        text = "Todavía no hay sitios."
                        setTextColor(Color.LTGRAY)
                    })
                }
            } catch (e: Exception) {
                runOnUiThread {
                    if (!isFinishing && !isDestroyed) toast(e.message ?: "No se pudieron cargar los sitios")
                }
            }
        }
    }

    private fun escapeHtml(value: String): String = value
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&#39;")

    private fun toast(message: String) {
        if (!isFinishing && !isDestroyed) Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }

    override fun onDestroy() {
        worker.shutdownNow()
        super.onDestroy()
    }
}
