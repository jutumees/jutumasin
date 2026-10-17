package com.jutumasin.app;

import android.webkit.WebView;
import android.view.View;
import android.view.ViewGroup;
import android.view.MotionEvent;
import android.os.SystemClock;
import org.json.JSONArray;
import android.content.Intent;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry;
import androidx.test.runner.lifecycle.Stage;
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
    private String js(String expression) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        if (activity == null) InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            activity = (MainActivity)ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(Stage.RESUMED).iterator().next();
        });
        activity.runOnUiThread(() -> findWeb(activity.getWindow().getDecorView()).evaluateJavascript(expression, value -> {
            result.set(value); latch.countDown();
        }));
        assertTrue("JavaScript callback timed out", latch.await(10, TimeUnit.SECONDS));
        return result.get();
    }
    private void touch(int action, float x, float y, long downTime) {
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            WebView web = findWeb(activity.getWindow().getDecorView());
            MotionEvent event = MotionEvent.obtain(downTime, SystemClock.uptimeMillis(), action, x, y, 0);
            event.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);
            web.dispatchTouchEvent(event);
            event.recycle();
        });
    }
    private void launch() throws Exception {
        // ActivityScenario waits for UI idleness; continuously animated WebViews need direct lifecycle observation.
        Intent intent = new Intent(InstrumentationRegistry.getInstrumentation().getTargetContext(), MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        InstrumentationRegistry.getInstrumentation().getTargetContext().startActivity(intent);
        for (int i = 0; i < 100 && activity == null; i++) {
            InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
                for (android.app.Activity candidate : ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(Stage.RESUMED)) {
                    if (candidate instanceof MainActivity) activity = (MainActivity)candidate;
                }
            });
            Thread.sleep(100);
        }
        assertNotNull("Activity did not resume", activity);
    }
    @Test public void cardFollowsNativeTouchBeforeRelease() throws Exception {
        launch();
        try {
            for (int i = 0; i < 50; i++) {
                if ("true".equals(js("typeof startGame === 'function'"))) break;
                Thread.sleep(200);
            }
            js("startGame('Dating')");
            JSONArray point = new JSONArray(js("(()=>{const r=document.querySelector('#deck .swipeCard:last-child .desc').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2,innerWidth]})()"));
            final float[] scale = {1};
            InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> scale[0] = findWeb(activity.getWindow().getDecorView()).getWidth() / (float)point.optDouble(2));
            float x = (float)point.getDouble(0) * scale[0], y = (float)point.getDouble(1) * scale[0];
            long down = SystemClock.uptimeMillis();
            touch(MotionEvent.ACTION_DOWN, x, y, down);
            for (int i = 1; i <= 8; i++) {
                touch(MotionEvent.ACTION_MOVE, x + 145 * scale[0] * i / 8, y, down);
                Thread.sleep(25);
            }
            assertEquals("true", js("document.querySelector('#deck .swipeCard:last-child').classList.contains('dragging')"));
            assertEquals("true", js("new DOMMatrix(getComputedStyle(document.querySelector('#deck .swipeCard:last-child')).transform).m41 > 130"));
            touch(MotionEvent.ACTION_UP, x + 145 * scale[0], y, down);
            Thread.sleep(300);
            assertEquals("1", js("State.index"));
        } finally { InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> activity.finish()); }
    }
    @Test public void offlineAssetsNavigationPersistenceAndNativeBridge() throws Exception {
        launch();
        try {
            for (int i = 0; i < 50; i++) {
                if ("true".equals(js("typeof startGame === 'function'"))) break;
                Thread.sleep(200);
            }
            assertEquals("true", js("typeof AndroidApp.showAd === 'function'"));
            js("document.querySelectorAll('.bgHearts,.bgHearts2').forEach(e=>e.style.animation='none')");
            js("showScreen('menu'); buildMenu()");
            assertEquals("true", js("startGame('Dating'); State.cards.length > 0"));
            assertEquals("\"game\"", js("State.viewMode"));
            js("document.getElementById('btnNext').click()");
            Thread.sleep(350);
            assertEquals("1", js("State.index"));
            assertEquals("true", js("androidBack()"));
            assertEquals("\"menu\"", js("State.viewMode"));
            assertEquals("true", js("JSON.parse(localStorage.getItem('jutumasin.v2')).state.index === 1"));
            // Exercise real native bridge no-fill completion without requesting/clicking an ad.
            js("showScreen('game'); renderStack(); adActive=true; adRequest=101; AndroidApp.showAd(101,0,0,100,100)");
            Thread.sleep(350);
            assertEquals("false", js("adActive"));
            assertEquals("true", js("document.querySelector('.brandLogo').naturalWidth > 0"));
        } finally { InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> activity.finish()); }
    }
}
