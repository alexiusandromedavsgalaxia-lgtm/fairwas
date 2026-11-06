package com.fairwas.android

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.inputmethod.EditorInfo
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Toast
import java.net.URLEncoder
import java.util.concurrent.Executors

/** Native Android browser shell. */
class BrowserActivity : Activity() {
    private lateinit var address: EditText
    private lateinit var web: WebView
    private lateinit var store: BrowserStore
    private lateinit var httc: HttcClient
    private val worker = Executors.newSingleThreadExecutor()
    private var currentAddress = "httc://home"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = BrowserStore(this)
        httc = HttcClient(BuildConfig.FAIRWAS_BASE_URL)
        buildUi()
        open(currentAddress)
    }

    private fun buildUi() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.rgb(14, 16, 22))
        }
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(10, 10, 10, 8)
        }
        address = EditText(this).apply {
            singleLine = true
            hint = "Buscar o introducir dirección HTTC"
            setTextColor(Color.WHITE)
            setHintTextColor(Color.LTGRAY)
            setBackgroundColor(Color.rgb(37, 41, 51))
            setPadding(14, 8, 14, 8)
            imeOptions = EditorInfo.IME_ACTION_GO
            setOnEditorActionListener { _, action, _ ->
                if (action == EditorInfo.IME_ACTION_GO) { open(text.toString()); true } else false
            }
        }
        bar.addView(address, LinearLayout.LayoutParams(0, 48, 1f))
        bar.addView(actionButton("Ir") { open(address.text.toString()) })
        bar.addView(actionButton("☆") {
            val added = store.toggleBookmark(currentAddress)
            toast(if (added) "Guardado en favoritos" else "Eliminado de favoritos")
        })
        root.addView(bar)

        val controls = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(8, 0, 8, 6)
        }
        controls.addView(actionButton("‹") { if (::web.isInitialized && web.canGoBack()) web.goBack() })
        controls.addView(actionButton("›") { if (::web.isInitialized && web.canGoForward()) web.goForward() })
        controls.addView(actionButton("↻") { open(currentAddress) })
        controls.addView(actionButton("Inicio") { open("httc://home") })
        controls.addView(actionButton("CreatePage") { startActivity(android.content.Intent(this@BrowserActivity, CreatePageActivity::class.java)) })
        controls.addView(actionButton("Historial") {
            val items = store.history().take(8)
            toast(if (items.isEmpty()) "El historial está vacío" else items.joinToString("\n"))
        })
        controls.addView(actionButton("Favoritos") {
            val items = store.bookmarks().take(8)
            toast(if (items.isEmpty()) "No hay favoritos guardados" else items.joinToString("\n"))
        })
        root.addView(controls)

        web = WebView(this).apply {
            setBackgroundColor(Color.rgb(14, 16, 22))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.loadsImagesAutomatically = true
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = true
            webChromeClient = WebChromeClient()
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                    if (url.startsWith("https://") && url.contains(".httc.local/")) return false
                    open(url)
                    return true
                }
                override fun shouldInterceptRequest(view: WebView, request: android.webkit.WebResourceRequest) =
                    httc.intercept(request)
            }
        }
        root.addView(web, LinearLayout.LayoutParams(-1, 0, 1f))
        setContentView(root)
    }

    private fun actionButton(label: String, action: () -> Unit) = Button(this).apply {
        text = label
        isAllCaps = false
        textSize = 12f
        setTextColor(Color.WHITE)
        setOnClickListener { action() }
    }

    private fun open(raw: String) {
        val target = try { httc.normalize(raw) } catch (e: Exception) {
            toast(e.message ?: "Dirección no válida")
            return
        }
        currentAddress = target
        address.setText(target)
        store.record(target)
        worker.execute {
            try {
                val page = httc.resolve(target)
                runOnUiThread {
                    val host = target.removePrefix("httc://").substringBefore('/').substringBefore('?')
                    val path = "/" + target.removePrefix("httc://").substringAfter('/', "")
                    val virtualBase = "https://" + host + ".httc.local" + path
                    val baseTag = "<base href=\"" + virtualBase + "\">"
                    val html = if (page.html.contains("<head", true)) {
                        page.html.replaceFirst(Regex("<head[^>]*>", RegexOption.IGNORE_CASE)) { it.value + baseTag }
                    } else baseTag + page.html
                    web.loadDataWithBaseURL(virtualBase, html, "text/html", "UTF-8", null)
                }
            } catch (e: Exception) {
                runOnUiThread {
                    val message = (e.message ?: "No se pudo abrir la página").replace("<", "&lt;")
                    web.loadDataWithBaseURL(null, "<meta name='viewport' content='width=device-width'><body style='background:#0e1016;color:white;font:16px sans-serif;padding:24px'><h2>No se puede abrir la página</h2><p>" + message + "</p></body>", "text/html", "UTF-8", null)
                }
            }
        }
    }

    private fun toast(message: String) = Toast.makeText(this, message, Toast.LENGTH_SHORT).show()

    override fun onDestroy() {
        worker.shutdownNow()
        if (::web.isInitialized) web.destroy()
        super.onDestroy()
    }
}
