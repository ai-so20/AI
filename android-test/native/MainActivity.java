package com.vipai.aiprocess.smoketest;

import android.graphics.Rect;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.content.Context;
import android.webkit.CookieManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

/**
 * Native behavior only. The member website, login API and Supabase data remain remote.
 *
 * WebView DOM storage is kept between process launches; the member login component itself
 * validates the persisted Supabase session and profile approval on each entry.
 */
public class MainActivity extends BridgeActivity {
    private static final String TAG = "AIProcessAndroid";
    private static final String SERVICE_ORIGIN = "https://ai-r6u0rn1ma-vipai.vercel.app";
    private static final String LOGIN_URL = SERVICE_ORIGIN + "/design-entry";
    private static final String HOME_URL = SERVICE_ORIGIN + "/design-home";
    private long lastExitAttempt = 0L;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (getBridge() == null) {
            Log.w(TAG, "Capacitor bridge unavailable");
            return;
        }

        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        final WebView webView = getBridge().getWebView();
        webView.getSettings().setDomStorageEnabled(true);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        final CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, false);

        // Preserve Capacitor's interceptors and errorPath handling; do not replace with a plain WebViewClient.
        getBridge().setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    Log.w(TAG, "Main-frame load failed, code=" + error.getErrorCode());
                }
                super.onReceivedError(view, request, error);
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame()) {
                    Log.w(TAG, "Main-frame HTTP status=" + response.getStatusCode());
                }
                super.onReceivedHttpError(view, request, response);
            }
        });

        // Web back covers Next.js SPA history. On a root screen, require a second press to exit.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                handleAppBack();
            }
        });
    }

    private boolean keyboardIsVisible() {
        View root = getWindow().getDecorView();
        Rect visible = new Rect();
        root.getWindowVisibleDisplayFrame(visible);
        int fullHeight = root.getRootView().getHeight();
        return fullHeight > 0 && fullHeight - visible.bottom > fullHeight * 0.20;
    }

    private void handleAppBack() {
        if (getBridge() == null) {
            finish();
            return;
        }

        WebView webView = getBridge().getWebView();

        if (keyboardIsVisible()) {
            InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
            if (imm != null) {
                imm.hideSoftInputFromWindow(webView.getWindowToken(), 0);
            }
            return;
        }

        String url = webView.getUrl();

        if (url != null && url.startsWith("https://localhost/offline.html")) {
            webView.loadUrl(LOGIN_URL);
            return;
        }

        if (webView.canGoBack()) {
            webView.goBack();
            return;
        }

        // Deep links to a member subpage without WebView history return to the app home.
        if (url != null && url.startsWith(SERVICE_ORIGIN)
                && !url.contains("/design-home") && !url.contains("/design-entry")) {
            webView.loadUrl(HOME_URL);
            return;
        }

        long now = SystemClock.elapsedRealtime();
        if (now - lastExitAttempt < 2000L) {
            finish();
        } else {
            lastExitAttempt = now;
            Toast.makeText(this, "한 번 더 누르면 앱이 종료됩니다.", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onPause() {
        CookieManager.getInstance().flush();
        super.onPause();
    }
}
