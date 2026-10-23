package org.ajdapp.wirelessrepairs;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.Toast;
import android.util.Base64;
import java.io.OutputStream;
import java.io.IOException;

public class MainActivity extends Activity {
    private static final String HOME_URL = "https://repair.ajdapp.org/";
    private static final String TRUSTED_HOST = "repair.ajdapp.org";
    private static final int FILE_CHOOSE_REQUEST = 1011;
    private static final int PDF_SAVE_REQUEST = 1012;

    private WebView webView;
    private ProgressBar progressBar;
    private ValueCallback<Uri[]> pendingFileChooser;
    private String pendingPdfBase64;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        progressBar.setProgressTintList(android.content.res.ColorStateList.valueOf(
                Color.rgb(37, 99, 235)));
        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, dp(3));
        root.addView(progressBar, progressParams);
        progressBar.setVisibility(View.GONE);

        setContentView(root);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " AJD-Android-App");

        // Keep printing inside the native app: Android WebView doesn't always
        // support JavaScript window.print() like Chrome does.
        webView.addJavascriptInterface(new ReceiptPrintBridge(), "AJDNativePrint");
        WebView.setWebContentsDebuggingEnabled(false);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri uri = request.getUrl();
                if ("https".equalsIgnoreCase(uri.getScheme())
                        && TRUSTED_HOST.equalsIgnoreCase(uri.getHost())) {
                    return false;
                }
                try {
                    Intent intent;
                    if ("tel".equalsIgnoreCase(uri.getScheme())) {
                        intent = new Intent(Intent.ACTION_DIAL, uri);
                    } else if ("mailto".equalsIgnoreCase(uri.getScheme())) {
                        intent = new Intent(Intent.ACTION_SENDTO, uri);
                    } else if ("https".equalsIgnoreCase(uri.getScheme())
                            || "http".equalsIgnoreCase(uri.getScheme())) {
                        intent = new Intent(Intent.ACTION_VIEW, uri);
                    } else {
                        return true;
                    }
                    startActivity(intent);
                } catch (ActivityNotFoundException err) {
                    Toast.makeText(MainActivity.this,
                            "No application can open this link.", Toast.LENGTH_LONG).show();
                }
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                                        android.webkit.WebResourceError error) {
                if (request.isForMainFrame()) {
                    Toast.makeText(MainActivity.this,
                            "Unable to load AJD's Wireless Repairs. Check your connection.",
                            Toast.LENGTH_LONG).show();
                }
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int progress) {
                progressBar.setProgress(progress);
                progressBar.setVisibility(progress < 100 ? View.VISIBLE : View.GONE);
            }

            // Enables selecting a product image or other file in Store Management.
            @Override
            public boolean onShowFileChooser(WebView view,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams params) {
                if (pendingFileChooser != null) pendingFileChooser.onReceiveValue(null);
                pendingFileChooser = filePathCallback;
                try {
                    Intent intent = params.createIntent();
                    startActivityForResult(intent, FILE_CHOOSE_REQUEST);
                    return true;
                } catch (ActivityNotFoundException err) {
                    pendingFileChooser = null;
                    Toast.makeText(MainActivity.this,
                            "No file picker is available.", Toast.LENGTH_LONG).show();
                    return false;
                }
            }
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(HOME_URL);
        }
    }

    // This bridge only opens Android's standard print preview for the currently
    // loaded HTTPS AJD dashboard. No data is sent to a separate print service.
    private boolean isTrustedPage() {
        if (webView == null || webView.getUrl() == null) return false;
        Uri page = Uri.parse(webView.getUrl());
        return "https".equalsIgnoreCase(page.getScheme())
                && TRUSTED_HOST.equalsIgnoreCase(page.getHost());
    }

    private class ReceiptPrintBridge {
        @JavascriptInterface
        public void savePdf(String base64, String requestedName) {
            // Android WebView does not support blob URL downloads reliably.
            // Ask Android where to save a client-generated PDF using Storage Access Framework.
            if (base64 == null || base64.length() > 6_000_000 || base64.isEmpty()) return;
            final String safeName = (requestedName == null ? "AJD-Receipt.pdf" : requestedName)
                    .replaceAll("[^A-Za-z0-9_.-]", "_");
            runOnUiThread(() -> {
                if (!isTrustedPage()) return;
                if (pendingPdfBase64 != null) {
                    Toast.makeText(MainActivity.this,
                            "Complete or cancel the current PDF save first.", Toast.LENGTH_SHORT).show();
                    return;
                }
                pendingPdfBase64 = base64;
                Intent picker = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                picker.addCategory(Intent.CATEGORY_OPENABLE);
                picker.setType("application/pdf");
                picker.putExtra(Intent.EXTRA_TITLE,
                        safeName.isEmpty() ? "AJD-Receipt.pdf" : safeName);
                try {
                    startActivityForResult(picker, PDF_SAVE_REQUEST);
                } catch (ActivityNotFoundException error) {
                    pendingPdfBase64 = null;
                    Toast.makeText(MainActivity.this,
                            "No app is available to save PDFs.", Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public void printReceipt() {
            runOnUiThread(() -> {
                if (!isTrustedPage()) return;
                PrintManager manager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                if (manager == null) {
                    Toast.makeText(MainActivity.this,
                            "Android printing is unavailable on this device.",
                            Toast.LENGTH_LONG).show();
                    return;
                }
                PrintAttributes attributes = new PrintAttributes.Builder()
                        .setColorMode(PrintAttributes.COLOR_MODE_MONOCHROME)
                        .build();
                manager.print("AJD Wireless Repairs Receipt",
                        webView.createPrintDocumentAdapter("AJD Receipt"),
                        attributes);
            });
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PDF_SAVE_REQUEST) {
            final String encoded = pendingPdfBase64;
            pendingPdfBase64 = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null
                    && encoded != null) {
                try (OutputStream stream = getContentResolver().openOutputStream(data.getData())) {
                    if (stream == null) throw new IOException("Cannot write to that location.");
                    byte[] pdf = Base64.decode(encoded, Base64.DEFAULT);
                    stream.write(pdf);
                    stream.flush();
                    Toast.makeText(this, "AJD PDF saved successfully.", Toast.LENGTH_LONG).show();
                } catch (Exception error) {
                    Toast.makeText(this,
                            "Unable to save PDF: " + error.getMessage(), Toast.LENGTH_LONG).show();
                }
            }
            return;
        }
        if (requestCode == FILE_CHOOSE_REQUEST && pendingFileChooser != null) {
            pendingFileChooser.onReceiveValue(
                    WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            pendingFileChooser = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        pendingPdfBase64 = null;
        if (pendingFileChooser != null) {
            pendingFileChooser.onReceiveValue(null);
            pendingFileChooser = null;
        }
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
