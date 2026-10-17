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
        java.util.Set<android.app.Activity> previous = java.util.Collections.newSetFromMap(new java.util.IdentityHashMap<>());
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> previous.addAll(ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(Stage.RESUMED)));
        Intent intent = new Intent(InstrumentationRegistry.getInstrumentation().getTargetContext(), MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        InstrumentationRegistry.getInstrumentation().getTargetContext().startActivity(intent);
        for (int i = 0; i < 100 && activity == null; i++) {
            InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
                for (android.app.Activity candidate : ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(Stage.RESUMED)) {
                    if (candidate instanceof MainActivity && !candidate.isFinishing() && !previous.contains(candidate)) activity = (MainActivity)candidate;
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
            js("startGame('Dating');window.touchLog=[];['pointerdown','pointermove','pointercancel','pointerup'].forEach(type=>document.addEventListener(type,e=>touchLog.push([type,e.clientX,e.clientY,e.target.className])))");
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
            assertEquals(js("JSON.stringify({events:touchLog,w:innerWidth,h:innerHeight,mode:State.viewMode})"),"true", js("document.querySelector('#deck .swipeCard:last-child').classList.contains('dragging')"));
            for (int i=0;i<20;i++) {
                if ("true".equals(js("new DOMMatrix(getComputedStyle(document.querySelector('#deck .swipeCard:last-child')).transform).m41 > 130"))) break;
                Thread.sleep(50);
            }
            assertEquals("true", js("new DOMMatrix(getComputedStyle(document.querySelector('#deck .swipeCard:last-child')).transform).m41 > 130"));
            touch(MotionEvent.ACTION_UP, x + 145 * scale[0], y, down);
            Thread.sleep(300);
            assertEquals("1", js("State.index"));
        } finally { InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> activity.finish()); }
    }
    @Test public void adSwipeDismissesWithoutClickingItsChild() throws Exception {
        launch();
        java.util.concurrent.atomic.AtomicInteger clicks = new java.util.concurrent.atomic.AtomicInteger();
        java.util.concurrent.atomic.AtomicInteger cancels = new java.util.concurrent.atomic.AtomicInteger();
        CountDownLatch dismissed = new CountDownLatch(1);
        try {
            InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
                SwipeDismissLayout card = new SwipeDismissLayout(activity);
                android.widget.Button child = new android.widget.Button(activity);
                child.setOnClickListener(v -> clicks.incrementAndGet());
                child.setOnTouchListener((v,e) -> { if(e.getActionMasked()==MotionEvent.ACTION_CANCEL) cancels.incrementAndGet(); return false; });
                card.addView(child, new ViewGroup.LayoutParams(400,500));
                card.setOnDismiss(dismissed::countDown);
                activity.addContentView(card,new ViewGroup.LayoutParams(400,500));
                card.measure(View.MeasureSpec.makeMeasureSpec(400,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(500,View.MeasureSpec.EXACTLY));
                card.layout(0,0,400,500);
                long down = SystemClock.uptimeMillis();
                int[] actions = {MotionEvent.ACTION_DOWN,MotionEvent.ACTION_UP,MotionEvent.ACTION_DOWN,MotionEvent.ACTION_MOVE,MotionEvent.ACTION_MOVE,MotionEvent.ACTION_UP};
                float[] xs = {20,20,20,100,220,220};
                for(int i=0;i<actions.length;i++) {
                    MotionEvent event=MotionEvent.obtain(down,down+i*25,actions[i],xs[i],200,0);
                    card.dispatchTouchEvent(event); event.recycle();
                }
            });
            assertTrue("Swipe dismissal did not finish",dismissed.await(3,TimeUnit.SECONDS));
            assertEquals("Tap is preserved and swipe is never an ad click",1,clicks.get());
            assertEquals("Swipe cancels the SDK child gesture",1,cancels.get());
        } finally { InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> activity.finish()); }
    }
    @Test public void childSafetyEmailOpensComposeWithoutSending() throws Exception {
        launch();
        android.content.IntentFilter filter = new android.content.IntentFilter(Intent.ACTION_SENDTO);
        filter.addDataScheme("mailto");
        android.app.Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        android.app.Instrumentation.ActivityMonitor monitor = instrumentation.addMonitor(filter,
            new android.app.Instrumentation.ActivityResult(android.app.Activity.RESULT_CANCELED,null),true);
        try {
            for(int i=0;i<50;i++) {
                if("true".equals(js("!!document.getElementById('childSafetyReport')"))) break;
                Thread.sleep(100);
            }
            assertEquals("true",js("document.getElementById('childSafetyReport').href.startsWith('mailto:renno.east@hotmail.com')"));
            instrumentation.runOnMainSync(() -> {
                WebView web=findWeb(activity.getWindow().getDecorView());
                web.getWebViewClient().shouldOverrideUrlLoading(web,new android.webkit.WebResourceRequest(){
                    public android.net.Uri getUrl(){return android.net.Uri.parse("mailto:renno.east@hotmail.com?subject=Jutumasin%20child%20safety%20report");}
                    public boolean isForMainFrame(){return true;}
                    public boolean isRedirect(){return false;}
                    public boolean hasGesture(){return true;}
                    public String getMethod(){return "GET";}
                    public java.util.Map<String,String> getRequestHeaders(){return java.util.Collections.emptyMap();}
                });
            });
            assertEquals("Email compose intent is dispatched, intercepted before opening or sending",1,monitor.getHits());
        } finally {
            instrumentation.removeMonitor(monitor);
            instrumentation.runOnMainSync(() -> activity.finish());
        }
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
