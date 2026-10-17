package com.jutumasin.app;

import android.content.Context;
import android.view.MotionEvent;
import android.view.ViewConfiguration;
import android.widget.LinearLayout;

/** Horizontal dismissal cancels the child gesture; taps and vertical scrolling stay with the ad. */
final class SwipeDismissLayout extends LinearLayout {
    private final int slop;
    private float startX, startY;
    private boolean dragging, finishing, multiple;
    private Runnable onDismiss;

    SwipeDismissLayout(Context context) {
        super(context);
        slop = ViewConfiguration.get(context).getScaledTouchSlop();
    }
    void setOnDismiss(Runnable callback) { onDismiss = callback; }

    @Override public boolean onInterceptTouchEvent(MotionEvent event) {
        if (finishing) return true;
        if (event.getActionMasked() == MotionEvent.ACTION_DOWN) {
            startX = event.getX(); startY = event.getY();
            dragging = false; multiple = false;
            animate().cancel();
        } else if (event.getPointerCount() > 1) {
            multiple = true;
        } else if (event.getActionMasked() == MotionEvent.ACTION_MOVE && !multiple) {
            float dx = event.getX() - startX, dy = event.getY() - startY;
            if (Math.abs(dx) > slop * 2 && Math.abs(dx) > Math.abs(dy) * 1.5f) dragging = true;
        }
        return dragging;
    }

    @Override public boolean onTouchEvent(MotionEvent event) {
        if (finishing) return true;
        float dx = event.getX() - startX;
        if (!dragging) {
            float dy = event.getY() - startY;
            if (event.getActionMasked() == MotionEvent.ACTION_MOVE && !multiple
                    && Math.abs(dx) > slop * 2 && Math.abs(dx) > Math.abs(dy) * 1.5f) dragging = true;
            else {
                if (event.getActionMasked() == MotionEvent.ACTION_UP) performClick();
                return true;
            }
        }
        switch (event.getActionMasked()) {
            case MotionEvent.ACTION_MOVE:
                setTranslationX(dx);
                break;
            case MotionEvent.ACTION_UP:
                dragging = false;
                if (Math.abs(dx) >= Math.max(slop * 4, getWidth() * .25f)) {
                    finishing = true;
                    animate().translationX(Math.copySign(getWidth(), dx)).alpha(0).setDuration(160)
                        .withEndAction(() -> { if (onDismiss != null) onDismiss.run(); }).start();
                } else resetPosition();
                break;
            case MotionEvent.ACTION_CANCEL:
            case MotionEvent.ACTION_POINTER_DOWN:
                dragging = false; multiple = true;
                resetPosition();
                break;
        }
        return true;
    }
    @Override public boolean performClick() { super.performClick(); return true; }
    private void resetPosition() { animate().translationX(0).alpha(1).setDuration(160).start(); }
}
