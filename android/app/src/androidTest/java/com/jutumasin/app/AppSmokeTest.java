package com.jutumasin.app;

import android.webkit.WebView;
import android.view.View;
import android.view.ViewGroup;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class AppSmokeTest {
    private MainActivity activity;
    private WebView findWeb(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                WebView found = findWeb(group.getChildAt(i));
                if (found != null) return found;
            }
        }
        return null;
    }
    private String js(ActivityScenario<MainActivity> scenario, String expression) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        if (activity == null) scenario.onActivity(value -> activity = value);
        activity.runOnUiThread(() -> findWeb(activity.getWindow().getDecorView()).evaluateJavascript(expression, value -> {
            result.set(value); latch.countDown();
        }));
        assertTrue("JavaScript callback timed out", latch.await(10, TimeUnit.SECONDS));
        return result.get();
    }
    @Test public void offlineAssetsNavigationPersistenceAndNativeBridge() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            for (int i = 0; i < 50; i++) {
                if ("true".equals(js(scenario, "typeof startGame === 'function'"))) break;
                Thread.sleep(200);
            }
            assertEquals("true", js(scenario, "typeof AndroidApp.showAd === 'function'"));
            js(scenario, "document.querySelectorAll('.bgHearts,.bgHearts2').forEach(e=>e.style.animation='none')");
            js(scenario, "showScreen('menu'); buildMenu()");
            assertEquals("true", js(scenario, "startGame('Dating'); State.cards.length > 0"));
            assertEquals("\"game\"", js(scenario, "State.viewMode"));
            js(scenario, "document.getElementById('btnNext').click()");
            Thread.sleep(350);
            assertEquals("1", js(scenario, "State.index"));
            assertEquals("true", js(scenario, "androidBack()"));
            assertEquals("\"menu\"", js(scenario, "State.viewMode"));
            assertEquals("true", js(scenario, "JSON.parse(localStorage.getItem('jutumasin.v2')).state.index === 1"));
            // Exercise real native bridge no-fill completion without requesting/clicking an ad.
            js(scenario, "showScreen('game'); renderStack(); adActive=true; adRequest=101; AndroidApp.showAd(101,0,0,100,100)");
            Thread.sleep(350);
            assertEquals("false", js(scenario, "adActive"));
            assertEquals("true", js(scenario, "document.querySelector('.brandLogo').naturalWidth > 0"));
        }
    }
}
