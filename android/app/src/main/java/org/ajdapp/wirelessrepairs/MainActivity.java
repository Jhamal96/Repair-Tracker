package org.ajdapp.wirelessrepairs;

import android.app.Activity;
import android.content.Intent;
import android.content.ActivityNotFoundException;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final String HOME = "https://repair.jhamal16.workers.dev/index.html";
    private static final String HOST = "repair.jhamal16.workers.dev";
    private static final int FILE_REQUEST = 12;
    private WebView browser;
    private ValueCallback<Uri[]> fileChooser;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        browser = new WebView(this);
        browser.setBackgroundColor(0xFF000000);
        setContentView(browser);

        WebSettings settings = browser.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " AJD-Android-App");

        browser.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return openExternal(request.getUrl());
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return openExternal(Uri.parse(url));
            }
        });

        browser.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams parameters) {
                if (fileChooser != null) fileChooser.onReceiveValue(null);
                fileChooser = callback;
                try {
                    startActivityForResult(parameters.createIntent(), FILE_REQUEST);
                    return true;
                } catch (ActivityNotFoundException ex) {
                    fileChooser = null;
                    Toast.makeText(MainActivity.this, "No file picker available", Toast.LENGTH_SHORT).show();
                    return false;
                }
            }
        });

        if (state != null) browser.restoreState(state);
        else browser.loadUrl(HOME);
    }

    private boolean openExternal(Uri uri) {
        if (uri == null) return true;
        if ("https".equalsIgnoreCase(uri.getScheme()) && HOST.equalsIgnoreCase(uri.getHost())) return false;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (Exception ex) {
            Toast.makeText(this, "Unable to open link", Toast.LENGTH_SHORT).show();
        }
        return true;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_REQUEST && fileChooser != null) {
            fileChooser.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileChooser = null;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        browser.saveState(state);
        super.onSaveInstanceState(state);
    }

    @Override
    public void onBackPressed() {
        if (browser != null && browser.canGoBack()) browser.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (fileChooser != null) {
            fileChooser.onReceiveValue(null);
            fileChooser = null;
        }
        if (browser != null) browser.destroy();
        super.onDestroy();
    }
}
