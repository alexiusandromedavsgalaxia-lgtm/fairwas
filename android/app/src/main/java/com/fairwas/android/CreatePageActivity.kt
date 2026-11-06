package com.fairwas.android

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.util.Patterns
import android.view.Gravity
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

/** Phone-first CreatePage dashboard. */
class CreatePageActivity : Activity() {
    private val worker = Executors.newSingleThreadExecutor()
    private lateinit var api: CreatePageClient
    private lateinit var content: LinearLayout
    private lateinit var nameField: EditText
    private lateinit var emailField: EditText
    private lateinit var hostField: EditText
    private lateinit var titleField: EditText

    private val pageBackground = Color.rgb(14, 16, 22)
    private val cardBackground = Color.rgb(29, 33, 42)
    private val muted = Color.rgb(166, 174, 188)
    private val accent = Color.rgb(185, 242, 139)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        api = CreatePageClient(BuildConfig.FAIRWAS_BASE_URL)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)

        val scroll = ScrollView(this).apply {
            fillViewport = true
            clipToPadding = false
            setBackgroundColor(pageBackground)
        }
        ViewCompat.setOnApplyWindowInsetsListener(scroll) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(18), dp(18), dp(24))
        }
        scroll.addView(root, ScrollView.LayoutParams(-1, -2))

        root.addView(TextView(this).apply {
            text = "CreatePage"
            textSize = 30f
            typeface = Typeface.create("sans-serif", Typeface.BOLD)
            setTextColor(Color.WHITE)
        })
        root.addView(TextView(this).apply {
            text = "Tus proyectos HTTC, desde Android."
            textSize = 14f
            setTextColor(muted)
            setPadding(0, dp(4), 0, dp(20))
        })

        val developerCard = sectionCard()
        developerCard.addView(sectionTitle("Desarrollador"))
        developerCard.addView(description("Registra tus datos para gestionar tus sitios."))
        nameField = field("Nombre de desarrollador")
        emailField = field("Correo electrónico").apply {
            inputType = android.text.InputType.TYPE_CLASS_TEXT or
                android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
        }
        developerCard.addView(nameField, fieldParams())
        developerCard.addView(emailField, fieldParams())
        developerCard.addView(primaryButton("Registrar desarrollador") {
            val name = nameField.text.toString().trim()
            val email = emailField.text.toString().trim()
            if (name.isBlank()) {
                toast("Introduce el nombre del desarrollador")
            } else if (!Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
                toast("Introduce un correo electrónico válido")
            } else {
                runRequest { api.registerDeveloper(name, email) }
            }
        }, buttonParams())
        root.addView(developerCard, sectionParams())

        val siteCard = sectionCard()
        siteCard.addView(sectionTitle("Nuevo sitio"))
        siteCard.addView(description("Crea y publica un nuevo dominio HTTC."))
        hostField = field("dominio.fair")
        titleField = field("Nombre del sitio")
        siteCard.addView(hostField, fieldParams())
        siteCard.addView(titleField, fieldParams())
        siteCard.addView(primaryButton("Crear sitio HTTC") {
            val host = hostField.text.toString().trim().lowercase()
            val title = titleField.text.toString().trim().ifBlank { host }
            if (!isValidHostname(host)) {
                toast("Introduce un dominio válido, por ejemplo sitio.fair")
            } else {
                val safeTitle = escapeHtml(title)
                val html = "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>$safeTitle</title></head><body><main><h1>$safeTitle</h1><p>Publicado con Fairwas para Android.</p></main></body></html>"
                runRequest { api.createSite(host, title, html) }
            }
        }, buttonParams())
        siteCard.addView(secondaryButton("Actualizar lista") { refreshSites() }, buttonParams())
        root.addView(siteCard, sectionParams())

        val sitesCard = sectionCard()
        sitesCard.addView(sectionTitle("Mis sitios"))
        sitesCard.addView(description("Tus dominios registrados aparecerán aquí."))
        content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        sitesCard.addView(content, LinearLayout.LayoutParams(-1, -2))
        root.addView(sitesCard, sectionParams())

        root.addView(secondaryButton("←  Volver al navegador") { finish() }, buttonParams())
        setContentView(scroll)
        ViewCompat.requestApplyInsets(scroll)
        refreshSites()
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun roundedBackground(color: Int, radiusDp: Int) = GradientDrawable().apply {
        setColor(color)
        cornerRadius = dp(radiusDp).toFloat()
    }

    private fun sectionCard() = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(16), dp(18), dp(16), dp(18))
        background = roundedBackground(cardBackground, 18)
    }

    private fun sectionTitle(value: String) = TextView(this).apply {
        text = value
        textSize = 19f
        typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        setTextColor(Color.WHITE)
    }

    private fun description(value: String) = TextView(this).apply {
        text = value
        textSize = 13f
        setTextColor(muted)
        setPadding(0, dp(4), 0, dp(12))
    }

    private fun field(hintText: String) = EditText(this).apply {
        hint = hintText
        setSingleLine(true)
        textSize = 15f
        setTextColor(Color.WHITE)
        setHintTextColor(muted)
        background = roundedBackground(Color.rgb(40, 45, 56), 12)
        setPadding(dp(14), 0, dp(14), 0)
        minHeight = dp(50)
    }

    private fun fieldParams() = LinearLayout.LayoutParams(-1, dp(52)).apply {
        bottomMargin = dp(10)
    }

    private fun primaryButton(label: String, action: () -> Unit) = TextView(this).apply {
        text = label
        gravity = Gravity.CENTER
        textSize = 14f
        typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        setTextColor(Color.rgb(20, 26, 18))
        background = roundedBackground(accent, 14)
        minHeight = dp(50)
        isClickable = true
        isFocusable = true
        setOnClickListener { action() }
    }

    private fun secondaryButton(label: String, action: () -> Unit) = TextView(this).apply {
        text = label
        gravity = Gravity.CENTER
        textSize = 14f
        typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        setTextColor(Color.WHITE)
        background = roundedBackground(Color.rgb(43, 48, 59), 14)
        minHeight = dp(50)
        isClickable = true
        isFocusable = true
        setOnClickListener { action() }
    }

    private fun buttonParams() = LinearLayout.LayoutParams(-1, dp(50)).apply {
        topMargin = dp(4)
        bottomMargin = dp(6)
    }

    private fun sectionParams() = LinearLayout.LayoutParams(-1, -2).apply {
        bottomMargin = dp(16)
    }

    private fun isValidHostname(host: String): Boolean {
        if (host.isBlank() || host.length > 253) return false
        return host.matches(
            Regex("^[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?(?:\\.[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?)+$")
        )
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
                        val item = LinearLayout(this).apply {
                            orientation = LinearLayout.VERTICAL
                            setPadding(dp(13), dp(13), dp(13), dp(13))
                            background = roundedBackground(Color.rgb(40, 45, 56), 13)
                        }
                        item.addView(TextView(this).apply {
                            text = title
                            textSize = 16f
                            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
                            setTextColor(Color.WHITE)
                        })
                        item.addView(TextView(this).apply {
                            text = "httc://$host"
                            textSize = 13f
                            setTextColor(accent)
                            setPadding(0, dp(4), 0, 0)
                        })
                        item.addView(TextView(this).apply {
                            text = status
                            textSize = 12f
                            setTextColor(muted)
                            setPadding(0, dp(4), 0, 0)
                        })
                        content.addView(item, LinearLayout.LayoutParams(-1, -2).apply {
                            bottomMargin = dp(9)
                        })
                    }
                    if (siteItems.isEmpty()) content.addView(TextView(this).apply {
                        text = "Todavía no hay sitios. Crea tu primer dominio arriba."
                        textSize = 13f
                        setTextColor(muted)
                        setPadding(0, dp(8), 0, dp(4))
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
