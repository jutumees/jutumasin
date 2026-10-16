package com.jutumasin.app;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.res.Configuration;
import java.util.Locale;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.WebViewAssetLoader;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdLoader;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.nativead.MediaView;
import com.google.android.gms.ads.nativead.NativeAd;
import com.google.android.gms.ads.nativead.NativeAdOptions;
import com.google.android.gms.ads.nativead.NativeAdView;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;
import java.io.ByteArrayInputStream;

public class MainActivity extends ComponentActivity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private WebView web;
    private FrameLayout root;
    private LinearLayout adCard;
    private NativeAdView adView;
    private NativeAd cachedAd, visibleAd;
    private ConsentInformation consent;
    private boolean initializing, initialized, loading, destroyed, privacyOpen;
    private int activeRequest = -1;
    private int consentGeneration;
    private long loadedAt, nextLoadAt;
    private boolean pageReady;
    private String language = "et";
    private TextView adAttribution;
    private Button adContinue;

    @SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle savedInstanceState) {
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        splash.setKeepOnScreenCondition(() -> !pageReady);
        // Release the system draw gate first, then keep its branded overlay until
        // WebView has submitted the actual menu frame underneath it.
        splash.setOnExitAnimationListener(provider -> web.postVisualStateCallback(1, new WebView.VisualStateCallback() {
            @Override public void onComplete(long requestId) {
                web.postOnAnimation(provider::remove);
            }
        }));
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(18, 0, 20));
        setContentView(root);
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, insets) -> {
            Insets safe = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
            return insets;
        });
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(18, 0, 20));
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse local = assets.shouldInterceptRequest(request.getUrl());
                return local != null ? local : new WebResourceResponse("text/plain", "UTF-8", 403,
                        "Forbidden", java.util.Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                // Only the bundled document can access the bridge. External links leave the app.
                if (request.isForMainFrame() && request.hasGesture() && "https".equals(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
                    catch (ActivityNotFoundException error) { toast(nativeText(R.string.browser_missing)); }
                }
                return true;
            }
            @Override public void onPageFinished(WebView view, String url) {
                pageReady = true;
                updatePrivacyButton();
            }
        });
        web.addJavascriptInterface(new Bridge(), "AndroidApp");
        web.loadUrl(ORIGIN + "/assets/index.html");
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (adCard != null) { closeAd(true); return; }
                web.evaluateJavascript("window.androidBack ? window.androidBack() : false", result -> {
                    if ("false".equals(result)) finish();
                });
            }
        });
        consent = UserMessagingPlatform.getConsentInformation(this);
        consent.requestConsentInfoUpdate(this, new ConsentRequestParameters.Builder().build(), () -> {
            if (destroyed) return;
            android.util.Log.i("JutumasinAds", "Consent info updated; canRequestAds=" + consent.canRequestAds());
            UserMessagingPlatform.loadAndShowConsentFormIfRequired(this, error -> {
                if (destroyed) return;
                if (error != null) android.util.Log.w("JutumasinAds", "Consent form: " + error.getErrorCode() + " " + error.getMessage());
                updatePrivacyButton();
                initializeAds();
            });
        }, error -> {
            android.util.Log.w("JutumasinAds", "Consent update: " + error.getErrorCode() + " " + error.getMessage());
            if (!destroyed) { updatePrivacyButton(); initializeAds(); }
        });
        initializeAds();
    }

    private void initializeAds() {
        if (destroyed || privacyOpen || !consent.canRequestAds()) return;
        if (initialized) { preload(); return; }
        if (initializing) return;
        initializing = true;
        new Thread(() -> MobileAds.initialize(getApplicationContext(), status -> runOnUiThread(() -> {
            initializing = false;
            initialized = true;
            android.util.Log.i("JutumasinAds", "Mobile Ads SDK initialized");
            preload();
        })), "ad-init").start();
    }

    private void preload() {
        if (destroyed || privacyOpen || !initialized || !consent.canRequestAds() || loading || cachedAd != null
                || SystemClock.elapsedRealtime() < nextLoadAt) return;
        loading = true;
        int generation = consentGeneration;
        new AdLoader.Builder(this, BuildConfig.NATIVE_AD_UNIT_ID)
            .forNativeAd(ad -> {
                loading = false;
                if (destroyed || generation != consentGeneration || privacyOpen || !consent.canRequestAds()) {
                    ad.destroy(); return;
                }
                if (cachedAd != null) cachedAd.destroy();
                cachedAd = ad;
                loadedAt = SystemClock.elapsedRealtime();
                android.util.Log.i("JutumasinAds", "Native ad loaded");
            })
            .withNativeAdOptions(new NativeAdOptions.Builder()
                .setAdChoicesPlacement(NativeAdOptions.ADCHOICES_TOP_RIGHT).build())
            .withAdListener(new AdListener() {
                @Override public void onAdFailedToLoad(LoadAdError error) {
                    loading = false;
                    nextLoadAt = SystemClock.elapsedRealtime() + 30000;
                    android.util.Log.i("JutumasinAds", "Native ad unavailable: " + error.getCode() + " " + error.getMessage());
                }
            }).build().loadAd(new AdRequest.Builder().build());
    }

    public final class Bridge {
        @JavascriptInterface public void setLanguage(String code) {
            if (!"et".equals(code) && !"en".equals(code)) return;
            runOnUiThread(() -> {
                language = code;
                if (adAttribution != null) adAttribution.setText(nativeText(R.string.ad_label));
                if (adContinue != null) adContinue.setText(nativeText(R.string.continue_game));
            });
        }
        @JavascriptInterface public void showAd(int request, float x, float y, float width, float height) {
            runOnUiThread(() -> displayAd(request, x, y, width, height));
        }
        @JavascriptInterface public void resizeAd(float x, float y, float width, float height) {
            runOnUiThread(() -> positionAd(x, y, width, height));
        }
        @JavascriptInterface public void dismissAd() { runOnUiThread(() -> closeAd(false)); }
        @JavascriptInterface public void privacyOptions() { runOnUiThread(() -> showPrivacyOptions()); }
    }

    private void displayAd(int request, float x, float y, float width, float height) {
        if (destroyed) return;
        if (adCard != null) closeAd(true);
        if (cachedAd != null && SystemClock.elapsedRealtime() - loadedAt > 3600000) {
            cachedAd.destroy(); cachedAd = null;
        }
        if (privacyOpen || !consent.canRequestAds() || cachedAd == null || width < 200 || height < 220) {
            adFinished(request); preload(); return;
        }
        visibleAd = cachedAd;
        cachedAd = null;
        activeRequest = request;
        adCard = new LinearLayout(this);
        adCard.setOrientation(LinearLayout.VERTICAL);
        GradientDrawable background = new GradientDrawable();
        background.setColor(Color.rgb(32, 8, 28));
        background.setCornerRadius(dp(22));
        background.setStroke(dp(1), Color.rgb(255, 77, 166));
        adCard.setBackground(background);
        adCard.setClipToOutline(true);
        adCard.setPadding(dp(12), dp(12), dp(12), dp(8));

        // Scroll keeps all ad assets accessible on small screens and in landscape.
        ScrollView scroll = new ScrollView(this);
        adView = new NativeAdView(this);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(4), 0, dp(4), dp(8));
        TextView attribution = label(nativeText(R.string.ad_label), 12);
        adAttribution = attribution;
        attribution.setPadding(0, 0, dp(36), dp(8));
        content.addView(attribution);
        LinearLayout heading = new LinearLayout(this);
        heading.setGravity(Gravity.CENTER_VERTICAL);
        if (visibleAd.getIcon() != null) {
            ImageView icon = new ImageView(this);
            icon.setImageDrawable(visibleAd.getIcon().getDrawable());
            heading.addView(icon, new LinearLayout.LayoutParams(dp(48), dp(48)));
            adView.setIconView(icon);
        }
        TextView headline = label(visibleAd.getHeadline(), 22);
        headline.setTypeface(null, Typeface.BOLD);
        headline.setPadding(dp(8), 0, 0, 0);
        heading.addView(headline, new LinearLayout.LayoutParams(0, -2, 1));
        content.addView(heading);
        adView.setHeadlineView(headline);
        if (visibleAd.getAdvertiser() != null) {
            TextView advertiser = label(visibleAd.getAdvertiser(), 13);
            content.addView(advertiser); adView.setAdvertiserView(advertiser);
        }
        MediaView media = new MediaView(this);
        LinearLayout.LayoutParams mediaParams = new LinearLayout.LayoutParams(-1, dp(180));
        mediaParams.topMargin = dp(12);
        content.addView(media, mediaParams);
        adView.setMediaView(media);
        media.setMediaContent(visibleAd.getMediaContent());
        if (visibleAd.getBody() != null) {
            TextView body = label(visibleAd.getBody(), 16);
            body.setPadding(0, dp(10), 0, dp(10));
            content.addView(body); adView.setBodyView(body);
        }
        if (visibleAd.getCallToAction() != null) {
            Button action = new Button(this);
            action.setText(visibleAd.getCallToAction());
            content.addView(action, new LinearLayout.LayoutParams(-1, -2));
            adView.setCallToActionView(action);
        }
        adView.addView(content, new FrameLayout.LayoutParams(-1, -2));
        scroll.addView(adView, new ScrollView.LayoutParams(-1, -2));
        adCard.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
        // Continue is outside NativeAdView; it is never an ad click target.
        Button next = new Button(this);
        next.setText(nativeText(R.string.continue_game));
        adContinue = next;
        next.setOnClickListener(view -> closeAd(true));
        adCard.addView(next, new LinearLayout.LayoutParams(-1, dp(52)));
        root.addView(adCard);
        positionAd(x, y, width, height);
        adView.setNativeAd(visibleAd);
        android.util.Log.i("JutumasinAds", "Native ad displayed");
    }

    private void positionAd(float x, float y, float width, float height) {
        if (adCard == null) return;
        if (!Float.isFinite(x) || !Float.isFinite(y) || !Float.isFinite(width) || !Float.isFinite(height)) return;
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(Math.max(1, dp(width)), Math.max(1, dp(height)));
        params.leftMargin = Math.max(0, dp(x));
        params.topMargin = Math.max(0, dp(y));
        adCard.setLayoutParams(params);
    }

    private void closeAd(boolean notify) {
        adContinue = null;
        adAttribution = null;
        int request = activeRequest;
        activeRequest = -1;
        if (adCard != null) { root.removeView(adCard); adCard = null; }
        if (adView != null) { adView.destroy(); adView = null; }
        if (visibleAd != null) { visibleAd.destroy(); visibleAd = null; }
        if (notify && request >= 0) adFinished(request);
        preload();
    }
    private void adFinished(int request) {
        if (!destroyed) web.evaluateJavascript("window.onNativeAdFinished && window.onNativeAdFinished(" + request + ")", null);
    }
    private void updatePrivacyButton() {
        if (consent == null || destroyed) return;
        boolean required = consent.getPrivacyOptionsRequirementStatus() == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED;
        web.evaluateJavascript("window.setPrivacyOptionsRequired && window.setPrivacyOptionsRequired(" + required + ")", null);
    }
    private void showPrivacyOptions() {
        if (destroyed || privacyOpen) return;
        privacyOpen = true;
        consentGeneration++;
        closeAd(true);
        if (cachedAd != null) { cachedAd.destroy(); cachedAd = null; }
        UserMessagingPlatform.showPrivacyOptionsForm(this, error -> {
            privacyOpen = false;
            if (destroyed) return;
            if (error != null) toast(nativeText(R.string.privacy_error));
            updatePrivacyButton(); initializeAds();
        });
    }
    private String nativeText(int id) {
        Configuration configuration = new Configuration(getResources().getConfiguration());
        configuration.setLocale(Locale.forLanguageTag(language));
        return createConfigurationContext(configuration).getString(id);
    }
    private TextView label(String text, int size) {
        TextView view = new TextView(this);
        view.setText(text); view.setTextSize(size); view.setTextColor(Color.rgb(255, 233, 245));
        return view;
    }
    private int dp(float value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private void toast(String message) { Toast.makeText(this, message, Toast.LENGTH_LONG).show(); }
    @Override protected void onPause() { web.onPause(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onDestroy() {
        destroyed = true;
        closeAd(false);
        if (cachedAd != null) { cachedAd.destroy(); cachedAd = null; }
        web.removeJavascriptInterface("AndroidApp");
        root.removeView(web);
        web.destroy();
        super.onDestroy();
    }
}
