package com.fairwas.android

import android.app.Activity
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.inputmethod.EditorInfo
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Toast
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

/** Native Android browser shell. */
class BrowserActivity : Activity() {
    private lateinit var address: EditText
    private lateinit var web: WebView
    private lateinit var store: BrowserStore
    private lateinit var httc: HttcClient
    private val worker = Executors.newSingleThreadExecutor()
    private val navigationId = AtomicInteger(0)
    private var currentAddress = "httc://home"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = BrowserStore(this)
        httc = HttcClient(BuildConfig.FAIRWAS_BASE_URL)
        buildUi()
        open(currentAddress)
    }

    private fun buildUi() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.rgb(14, 16, 22))
        }
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }

        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(10, 10, 10, 8)
        }
        address = EditText(this).apply {
            setSingleLine(true)
            hint = "Introducir dirección HTTC"
            setTextColor(Color.WHITE)
            setHintTextColor(Color.LTGRAY)
            setBackgroundColor(Color.rgb(37, 41, 51))
            setPadding(14, 8, 14, 8)
            imeOptions = EditorInfo.IME_ACTION_GO
            setOnEditorActionListener { _, action, _ ->
                if (action == EditorInfo.IME_ACTION_GO) {
                    open(text.toString())
                    true
                } else false
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
        controls.addView(actionButton("CreatePage") {
            startActivity(android.content.Intent(this@BrowserActivity, CreatePageActivity::class.java))
        })
        controls.addView(actionButton("Historial") {
            showAddressList("Historial", store.history().take(30))
        })
        controls.addView(actionButton("Favoritos") {
            showAddressList("Favoritos", store.bookmarks())
        })
        root.addView(controls)

        web = WebView(this).apply {
            setBackgroundColor(Color.rgb(14, 16, 22))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.loadsImagesAutomatically = true
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            webChromeClient = WebChromeClient()
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val uri = request.url
                    if (uri.scheme.equals("https", true) &&
                        uri.host?.endsWith(".httc.local", true) == true) return false
                    if (uri.scheme.equals("httc", true) && uri.host.equals("createpage.fair", true)) {
                        openCreatePage()
                        return true
                    }
                    open(uri.toString())
                    return true
                }

                @Suppress("DEPRECATION")
                override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                    val uri = Uri.parse(url)
                    if (uri.scheme.equals("https", true) &&
                        uri.host?.endsWith(".httc.local", true) == true) return false
                    if (uri.scheme.equals("httc", true) && uri.host.equals("createpage.fair", true)) {
                        openCreatePage()
                        return true
                    }
                    open(url)
                    return true
                }

                override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                    super.onPageStarted(view, url, favicon)
                    syncAddressFromWebView(url)
                }

                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest) =
                    httc.intercept(request)
            }
        }
        root.addView(web, LinearLayout.LayoutParams(-1, 0, 1f))
        setContentView(root)
        ViewCompat.requestApplyInsets(root)
    }

    private fun actionButton(label: String, action: () -> Unit) = Button(this).apply {
        text = label
        isAllCaps = false
        textSize = 12f
        setTextColor(Color.WHITE)
        setOnClickListener { action() }
    }

    private fun openCreatePage() {
        if (!isFinishing && !isDestroyed) {
            startActivity(android.content.Intent(this, CreatePageActivity::class.java))
        }
    }

    private fun syncAddressFromWebView(rawUrl: String) {
        if (isFinishing || isDestroyed) return
        val uri = Uri.parse(rawUrl)
        val virtualHost = uri.host ?: return
        if (!virtualHost.endsWith(".httc.local", true)) return
        val host = virtualHost.removeSuffix(".httc.local")
        val path = uri.encodedPath?.ifEmpty { "/" } ?: "/"
        val query = uri.encodedQuery?.let { "?$it" } ?: ""
        val fragment = uri.encodedFragment?.let { "#$it" } ?: ""
        val target = if (host.equals("home", true)) "httc://home" else "httc://$host$path$query$fragment"
        currentAddress = target
        if (address.text.toString() != target) address.setText(target)
        store.record(target)
    }

    private fun open(raw: String) {
        val candidate = Uri.parse(raw.trim())
        if (candidate.scheme.equals("httc", true) && candidate.host.equals("createpage.fair", true)) {
            openCreatePage()
            return
        }
        val target = try {
            httc.normalize(raw)
        } catch (e: Exception) {
            toast(e.message ?: "Dirección no válida")
            return
        }

        val requestId = navigationId.incrementAndGet()
        currentAddress = target
        address.setText(target)
        store.record(target)

        if (target.equals("httc://home", true)) {
            val home = """
                <!doctype html><html lang="es"><head><meta charset="utf-8">
                <meta name="viewport" content="width=device-width,initial-scale=1">
                <title>Fairwas</title>
                <style>
                *{box-sizing:border-box}body{margin:0;background:#0e1016;color:#f4f6fa;font:16px system-ui}
                main{max-width:760px;margin:8vh auto;padding:28px}h1{font-size:clamp(36px,8vw,64px);margin:0 0 8px}
                p{color:#aeb6c5;line-height:1.6}.card{background:#222630;border:1px solid #343b49;border-radius:16px;padding:20px;margin-top:22px}
                a{display:inline-block;color:#b9f28b;text-decoration:none;font-weight:650;margin:8px 18px 0 0}
                small{color:#929bad}
                </style></head><body><main><small>ANDROID EDITION</small><h1>Fairwas</h1>
                <p>Tu navegador para la web HTTC. Escribe un dominio HTTC en la barra superior para empezar.</p>
                <section class="card"><b>Accesos rápidos</b><p><a href="httc://createpage.fair">CreatePage</a></p></section>
                <p><small>Versión Android en desarrollo.</small></p></main></body></html>
            """.trimIndent()
            web.loadDataWithBaseURL("https://home.httc.local/", home, "text/html", "UTF-8", null)
            return
        }

        worker.execute {
            try {
                val page = httc.resolve(target)
                runOnUiThread {
                    if (isFinishing || isDestroyed || requestId != navigationId.get()) return@runOnUiThread
                    val parsed = Uri.parse(target)
                    val host = parsed.host ?: "home"
                    val path = parsed.encodedPath?.ifEmpty { "/" } ?: "/"
                    val query = parsed.encodedQuery?.let { "?$it" } ?: ""
                    val virtualBase = "https://$host.httc.local$path$query"
                    val baseTag = "<base href=\"https://$host.httc.local$path\">"
                    val headTag = Regex("<head[^>]*>", RegexOption.IGNORE_CASE).find(page.html)
                    val html = if (headTag != null) {
                        page.html.replaceRange(headTag.range, headTag.value + baseTag)
                    } else {
                        "<!doctype html><html><head>$baseTag</head><body>${page.html}</body></html>"
                    }
                    web.loadDataWithBaseURL(virtualBase, html, "text/html", "UTF-8", null)
                }
            } catch (e: Exception) {
                runOnUiThread {
                    if (isFinishing || isDestroyed || requestId != navigationId.get()) return@runOnUiThread
                    val message = (e.message ?: "No se pudo abrir la página")
                        .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                        .replace("\"", "&quot;").replace("'", "&#39;")
                    web.loadDataWithBaseURL(
                        null,
                        "<meta name='viewport' content='width=device-width'><body style='background:#0e1016;color:white;font:16px sans-serif;padding:24px'><h2>No se puede abrir la página</h2><p>$message</p></body>",
                        "text/html",
                        "UTF-8",
                        null
                    )
                }
            }
        }
    }

    private fun showAddressList(title: String, items: List<String>) {
        if (isFinishing || isDestroyed) return
        if (items.isEmpty()) {
            toast(if (title == "Historial") "El historial está vacío" else "No hay favoritos guardados")
            return
        }
        android.app.AlertDialog.Builder(this)
            .setTitle(title)
            .setItems(items.toTypedArray()) { _, which -> open(items[which]) }
            .setNegativeButton("Cerrar", null)
            .show()
    }

    private fun toast(message: String) {
        if (!isFinishing && !isDestroyed) Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }

    override fun onDestroy() {
        navigationId.incrementAndGet()
        worker.shutdownNow()
        if (::web.isInitialized) {
            web.stopLoading()
            web.destroy()
        }
        super.onDestroy()
    }
}
