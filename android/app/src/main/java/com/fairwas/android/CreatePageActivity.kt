package com.fairwas.android

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.core.view.WindowCompat
import org.json.JSONArray
import org.json.JSONObject

/**
 * Runs Fairwas' real deployed React workspace inside Android WebView.
 *
 * CreatePage and YourCode are not reimplemented here: the same production
 * React components, routes, editor, parsers and API are loaded from Fairwas.
 */
class CreatePageActivity : Activity() {
    companion object {
        const val EXTRA_START_URL = "com.fairwas.android.START_WORKSPACE_URL"
        private const val STORAGE_KEY = "fairwas:v1"
    }

    private lateinit var web: WebView
    private lateinit var appBaseUrl: String
    private var initialWorkspaceInstalled = false
    private var workspaceStyleInstalled = false

    private val background = Color.rgb(14, 16, 22)
    private val surface = Color.rgb(29, 33, 42)
    private val textColor = Color.rgb(245, 247, 251)
    private val accent = Color.rgb(185, 242, 139)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, true)
        window.statusBarColor = background
        window.navigationBarColor = background
        window.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)

        appBaseUrl = BuildConfig.FAIRWAS_BASE_URL.trimEnd('/')
        val baseUri = Uri.parse(appBaseUrl)
        if (!baseUri.scheme.equals("https", true) || baseUri.host.isNullOrBlank()) {
            showFatal("La dirección de Fairwas debe ser una URL HTTPS válida.")
            return
        }

        buildUi()
        web.loadUrl("$appBaseUrl/")
    }

    private fun buildUi() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(background)
        }

        val toolbar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(8), dp(4), dp(14), dp(4))
            setBackgroundColor(background)
        }
        val back = TextView(this).apply {
            text = "‹"
            textSize = 30f
            gravity = Gravity.CENTER
            setTextColor(textColor)
            minWidth = dp(44)
            minHeight = dp(44)
            contentDescription = "Volver al navegador"
            setOnClickListener { finish() }
        }
        toolbar.addView(back, LinearLayout.LayoutParams(dp(48), dp(48)))
        toolbar.addView(LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_VERTICAL
            addView(TextView(this@CreatePageActivity).apply {
                text = "Fairwas Workspace"
                textSize = 15f
                typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
                setTextColor(textColor)
            })
            addView(TextView(this@CreatePageActivity).apply {
                text = "CreatePage · YourCode"
                textSize = 11f
                setTextColor(accent)
            })
        }, LinearLayout.LayoutParams(0, -2, 1f))
        root.addView(toolbar, LinearLayout.LayoutParams(-1, dp(56)))

        web = WebView(this).apply {
            setBackgroundColor(background)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.loadsImagesAutomatically = true
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.javaScriptCanOpenWindowsAutomatically = false
            settings.setSupportMultipleWindows(false)
            settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            settings.safeBrowsingEnabled = true
            webChromeClient = WebChromeClient()
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val uri = request.url
                    if (uri.scheme.equals("https", true) && uri.host.equals(Uri.parse(appBaseUrl).host, true)) {
                        return false
                    }
                    if (uri.scheme.equals("httc", true)) {
                        val host = uri.host?.lowercase().orEmpty()
                        if (host == "createpage.fair" || host == "yourcode.official" ||
                            host == "yourcode.createpage.fair" || host == "docs.createpage.fair") {
                            installWorkspaceState(uri.toString())
                            return true
                        }
                    }
                    return true
                }

                override fun onPageFinished(view: WebView, url: String) {
                    super.onPageFinished(view, url)
                    if (!isTrustedAppUrl(url)) return
                    if (!initialWorkspaceInstalled) {
                        initialWorkspaceInstalled = true
                        installWorkspaceState(startUrl())
                    } else if (!workspaceStyleInstalled) {
                        workspaceStyleInstalled = true
                        applyPhoneWorkspaceStyle()
                    }
                }

                override fun onReceivedError(
                    view: WebView,
                    request: WebResourceRequest,
                    error: android.webkit.WebResourceError
                ) {
                    super.onReceivedError(view, request, error)
                    if (request.isForMainFrame && !isFinishing && !isDestroyed) {
                        Toast.makeText(
                            this@CreatePageActivity,
                            "No se pudo conectar con Fairwas. Comprueba tu conexión.",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }
            }
        }
        root.addView(web, LinearLayout.LayoutParams(-1, 0, 1f))
        setContentView(root)
    }

    private fun startUrl(): String {
        return intent.getStringExtra(EXTRA_START_URL)
            ?.takeIf { it.startsWith("httc://") }
            ?: "httc://createpage.fair/"
    }

    private fun isTrustedAppUrl(raw: String): Boolean {
        val uri = Uri.parse(raw)
        return uri.scheme.equals("https", true) &&
            uri.host.equals(Uri.parse(appBaseUrl).host, true)
    }

    private fun installWorkspaceState(targetUrl: String) {
        if (!::web.isInitialized || isFinishing || isDestroyed) return
        val title = if (targetUrl.contains("yourcode", true)) "YourCode" else "CreatePage"
        val tab = JSONObject()
            .put("id", "android-workspace")
            .put("url", targetUrl)
            .put("documentUrl", targetUrl)
            .put("title", title)
            .put("back", JSONArray())
            .put("forward", JSONArray())
        val state = JSONObject()
            .put("history", JSONArray())
            .put("bookmarks", JSONArray())
            .put("settings", JSONObject()
                .put("dark", true)
                .put("home", "httc://home")
                .put("search", "")
                .put("compactChrome", true))
            .put("tabs", JSONArray().put(tab))
            .put("activeTab", 0)
            .put("currentPage", targetUrl)
            .put("activity", "browsing")

        val stateLiteral = JSONObject.quote(state.toString())
        val rootLiteral = JSONObject.quote("$appBaseUrl/")
        web.evaluateJavascript(
            "(function(){localStorage.setItem('$STORAGE_KEY',$stateLiteral);location.replace($rootLiteral);})();",
            null
        )
    }

    private fun applyPhoneWorkspaceStyle() {
        val css = """
            html,body,#root,.app,.viewport,.tab-view {
                width:100%!important; min-width:0!important;
                min-height:100%!important; height:100%!important;
                overflow-x:hidden!important;
            }
            .chrome { display:none!important; }
            .app { min-height:100dvh!important; height:100dvh!important; }
            .viewport { min-height:100dvh!important; height:100dvh!important; overflow:auto!important; }
            .tab-view { min-height:100%!important; }
            .cp-shell { min-height:100%!important; grid-template-columns:minmax(0,1fr)!important; }
            .cp-side { position:relative!important; top:auto!important; padding:10px 12px!important;
                border-right:0!important; border-bottom:1px solid rgba(255,255,255,.08)!important; }
            .cp-brand { padding:3px 6px 9px!important; }
            .cp-side nav { display:flex!important; flex-direction:row!important; overflow-x:auto!important;
                flex-wrap:nowrap!important; gap:4px!important; scrollbar-width:none; }
            .cp-side nav button { flex:none!important; white-space:nowrap!important; }
            .cp-side-foot { display:none!important; }
            .cp-content { width:100%!important; max-width:none!important;
                padding:20px 14px max(26px,env(safe-area-inset-bottom))!important; }
            .cp-grid.four,.cp-grid.three { grid-template-columns:repeat(2,minmax(0,1fr))!important; }
            .cp-grid.two { grid-template-columns:minmax(0,1fr)!important; }
            .cp-ide { position:relative!important; inset:auto!important; min-height:100%!important; }
            .cp-ide-top { padding:12px!important; align-items:flex-start!important; flex-direction:column!important; }
            .cp-ide-actions { width:100%!important; overflow-x:auto!important; flex-wrap:nowrap!important; }
            .cp-ide-actions button { flex:none!important; min-height:42px!important; }
            .cp-ide-import { grid-template-columns:minmax(0,1fr)!important; }
            .cp-ide-body { grid-template-columns:minmax(96px,30%) minmax(0,1fr)!important; min-height:55vh!important; }
            .cp-files { padding:6px!important; }
            .cp-files button { overflow-wrap:anywhere!important; font-size:11px!important; }
            .cp-editor { min-width:0!important; padding:12px!important; font-size:12px!important; }
            .yc-app { min-height:100%!important; }
            .yc-header { position:relative!important; flex-wrap:wrap!important; gap:8px!important; padding:12px!important; }
            .yc-nav { max-width:100%!important; overflow-x:auto!important; }
            .yc-content { padding:18px 13px max(26px,env(safe-area-inset-bottom))!important; }
            .yc-hero { grid-template-columns:minmax(0,1fr)!important; }
            .yc-hero-art { display:none!important; }
            .yc-workspace { grid-template-columns:minmax(0,1fr)!important; min-height:0!important; }
            .yc-preview { grid-column:auto!important; }
            .yc-pane { min-height:320px!important; }
            .yc-pane textarea { min-height:260px!important; }
            .yc-preview iframe { min-height:360px!important; }
            button,input,select,textarea { max-width:100%; }
            img,iframe,pre { max-width:100%; }
            @media(max-width:420px) {
                .cp-grid.four,.cp-grid.three { grid-template-columns:minmax(0,1fr)!important; }
                .cp-ide-body { grid-template-columns:92px minmax(0,1fr)!important; }
                .cp-editor { font-size:11px!important; }
            }
        """.trimIndent()
        val cssLiteral = JSONObject.quote(css)
        web.evaluateJavascript(
            "(function(){var id='fairwas-android-phone-style';var s=document.getElementById(id);if(!s){s=document.createElement('style');s.id=id;document.head.appendChild(s);}s.textContent=$cssLiteral;})();",
            null
        )
    }

    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        if (::web.isInitialized && web.canGoBack()) web.goBack() else super.onBackPressed()
    }

    private fun showFatal(message: String) {
        val label = TextView(this).apply {
            text = message
            textSize = 15f
            setTextColor(textColor)
            gravity = Gravity.CENTER
            setPadding(dp(24), dp(24), dp(24), dp(24))
        }
        setContentView(LinearLayout(this).apply {
            gravity = Gravity.CENTER
            setBackgroundColor(background)
            addView(label)
        })
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    override fun onDestroy() {
        if (::web.isInitialized) {
            web.stopLoading()
            web.destroy()
        }
        super.onDestroy()
    }
}
