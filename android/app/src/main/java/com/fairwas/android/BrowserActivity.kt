package com.fairwas.android

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.inputmethod.EditorInfo
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.PopupMenu
import android.widget.TextView
import android.widget.Toast
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

/** Phone-first native Android browser shell. */
class BrowserActivity : Activity() {
    private lateinit var address: EditText
    private lateinit var web: WebView
    private lateinit var store: BrowserStore
    private lateinit var httc: HttcClient
    private val worker = Executors.newSingleThreadExecutor()
    private val navigationId = AtomicInteger(0)
    private var currentAddress = "httc://home"

    private val pageBackground = Color.rgb(14, 16, 22)
    private val surface = Color.rgb(29, 33, 42)
    private val accent = Color.rgb(185, 242, 139)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = BrowserStore(this)
        httc = HttcClient(BuildConfig.FAIRWAS_BASE_URL)
        buildUi()
        open(currentAddress)
    }

    private fun buildUi() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(pageBackground)
        }
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }

        // Compact address bar: the URL gets all flexible width on narrow phones.
        val addressBar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(12), dp(8), dp(12), dp(8))
            setBackgroundColor(pageBackground)
        }
        address = EditText(this).apply {
            setSingleLine(true)
            textSize = 15f
            hint = "Dirección HTTC"
            setTextColor(Color.WHITE)
            setHintTextColor(Color.rgb(155, 163, 177))
            background = roundedBackground(surface, 14)
            setPadding(dp(14), 0, dp(10), 0)
            imeOptions = EditorInfo.IME_ACTION_GO
            inputType = android.text.InputType.TYPE_CLASS_TEXT or
                android.text.InputType.TYPE_TEXT_VARIATION_URI
            setSelectAllOnFocus(true)
            setOnEditorActionListener { _, action, _ ->
                if (action == EditorInfo.IME_ACTION_GO) {
                    open(text.toString())
                    true
                } else false
            }
        }
        addressBar.addView(address, LinearLayout.LayoutParams(0, dp(48), 1f))
        addressBar.addView(topIconButton("↵", "Abrir dirección") { open(address.text.toString()) })
        addressBar.addView(topIconButton("☆", "Añadir a favoritos") {
            val added = store.toggleBookmark(currentAddress)
            toast(if (added) "Añadido a favoritos" else "Eliminado de favoritos")
        })
        root.addView(addressBar, LinearLayout.LayoutParams(-1, dp(64)))

        web = WebView(this).apply {
            setBackgroundColor(pageBackground)
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
                    if (uri.scheme.equals("httc", true) && isWorkspaceHost(uri.host)) {
                        openWorkspace(uri.toString())
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
                    if (uri.scheme.equals("httc", true) && isWorkspaceHost(uri.host)) {
                        openWorkspace(uri.toString())
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

        // Bottom navigation keeps every control reachable with a thumb on phone screens.
        val bottomBar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.rgb(24, 27, 35))
            setPadding(dp(4), dp(4), dp(4), dp(4))
        }
        bottomBar.addView(navButton("‹\nAtrás") {
            if (web.canGoBack()) web.goBack() else toast("No hay página anterior")
        })
        bottomBar.addView(navButton("›\nAdel.") {
            if (web.canGoForward()) web.goForward() else toast("No hay página siguiente")
        })
        bottomBar.addView(navButton("⌂\nInicio") { open("httc://home") })
        bottomBar.addView(navButton("+\nCrear") { openCreatePage() })
        val more = navButton("⋯\nMás") { showMoreMenu(it) }
        bottomBar.addView(more)
        root.addView(bottomBar, LinearLayout.LayoutParams(-1, dp(60)))

        setContentView(root)
        ViewCompat.requestApplyInsets(root)
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun roundedBackground(color: Int, radiusDp: Int) = GradientDrawable().apply {
        setColor(color)
        cornerRadius = dp(radiusDp).toFloat()
    }

    private fun topIconButton(label: String, description: String, action: () -> Unit) =
        TextView(this).apply {
            text = label
            contentDescription = description
            textSize = 23f
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            minWidth = dp(44)
            minHeight = dp(48)
            setOnClickListener { action() }
        }

    private fun navButton(label: String, action: (TextView) -> Unit) =
        TextView(this).apply {
            text = label
            gravity = Gravity.CENTER
            textAlignment = TextView.TEXT_ALIGNMENT_CENTER
            textSize = 11f
            setLineSpacing(0f, 0.95f)
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            setTextColor(Color.rgb(224, 228, 236))
            minHeight = dp(52)
            isClickable = true
            isFocusable = true
            background = android.util.TypedValue().let {
                val out = android.util.TypedValue()
                theme.resolveAttribute(android.R.attr.selectableItemBackground, out, true)
                androidx.core.content.ContextCompat.getDrawable(this@BrowserActivity, out.resourceId)
            }
            layoutParams = LinearLayout.LayoutParams(0, dp(52), 1f)
            setOnClickListener { action(this) }
        }

    private fun showMoreMenu(anchor: TextView) {
        PopupMenu(this, anchor).apply {
            menu.add("Historial").setOnMenuItemClickListener {
                showAddressList("Historial", store.history().take(50)); true
            }
            menu.add("Favoritos").setOnMenuItemClickListener {
                showAddressList("Favoritos", store.bookmarks()); true
            }
            menu.add("Recargar").setOnMenuItemClickListener {
                open(currentAddress); true
            }
            menu.add("CreatePage").setOnMenuItemClickListener {
                openCreatePage(); true
            }
            show()
        }
    }

    private fun isWorkspaceHost(host: String?): Boolean {
        return host.equals("createpage.fair", true) ||
            host.equals("docs.createpage.fair", true) ||
            host.equals("yourcode.official", true) ||
            host.equals("yourcode.createpage.fair", true)
    }

    private fun openWorkspace(rawUrl: String) {
        if (isFinishing || isDestroyed) return
        val intent = android.content.Intent(this, CreatePageActivity::class.java)
            .putExtra(CreatePageActivity.EXTRA_START_URL, rawUrl)
        startActivity(intent)
    }

    private fun openCreatePage() = openWorkspace("httc://createpage.fair/")

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
        if (candidate.scheme.equals("httc", true) && isWorkspaceHost(candidate.host)) {
            openWorkspace(candidate.toString())
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
                <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
                <title>Fairwas</title>
                <style>
                *{box-sizing:border-box}body{margin:0;min-height:100vh;background:#0e1016;color:#f4f6fa;font:16px system-ui}
                main{width:100%;max-width:680px;margin:0 auto;padding:clamp(20px,6vw,32px)}
                .eyebrow{color:#b9f28b;font-size:12px;font-weight:700;letter-spacing:.12em}
                h1{font-size:clamp(40px,12vw,56px);line-height:1.04;margin:14px 0}
                p{color:#aeb6c5;line-height:1.6}.card{background:#222630;border:1px solid #343b49;border-radius:18px;padding:20px;margin-top:24px}
                a{display:flex;min-height:48px;align-items:center;color:#b9f28b;text-decoration:none;font-weight:650}
                small{color:#929bad}
                </style></head><body><main><div class="eyebrow">ANDROID EDITION</div><h1>Fairwas</h1>
                <p>Tu navegador para la web HTTC. Escribe una dirección en la barra superior para empezar.</p>
                <section class="card"><b>Acceso rápido</b><a href="httc://createpage.fair">＋ &nbsp; Abrir CreatePage</a></section>
                <p><small>Diseñado para Android.</small></p></main></body></html>
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
                        "<meta name='viewport' content='width=device-width,initial-scale=1'><body style='background:#0e1016;color:white;font:16px sans-serif;padding:24px'><h2>No se puede abrir la página</h2><p>$message</p></body>",
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
