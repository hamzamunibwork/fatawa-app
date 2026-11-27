package com.abdulhasib.fatawa;

// الفتاوى الميسّرة — Al-Fatawa Al-Muyassara
// جمعه وأعده: عبد الحسيب منيب
// يعرض صفحات التطبيق المحفوظة داخله (assets/www) عبر عنوان https محلي.

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import java.util.Locale;
import android.webkit.JavascriptInterface;
import org.json.JSONObject;
import java.util.ArrayList;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.webkit.WebViewAssetLoader;

public class MainActivity extends Activity {
    private static final String HOME = "https://appassets.androidplatform.net/assets/www/index.html";
    private WebView web;
    private static final int VOICE = 41;
    private TextToSpeech tts;                 // القراءة الصوتية بمحرك الجهاز
    private volatile boolean ttsReady = false;
    private volatile boolean ttsInitDone = false;

    private static boolean hasOrigin(WebResourceRequest r) {
        java.util.Map<String, String> h = r.getRequestHeaders();
        if (h == null) return false;
        for (String k : h.keySet()) if ("origin".equalsIgnoreCase(k)) return true;
        return false;
    }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);           // الإعدادات والتلاوات المحمّلة
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setTextZoom(100);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                // تحميل التلاوة للاستماع بلا إنترنت: يُسمح للصفحة بقراءة ملفات everyayah عند التحميل فقط
                if ("everyayah.com".equals(u.getHost()) && "GET".equals(request.getMethod()) && hasOrigin(request)) {
                    try {
                        java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(u.toString()).openConnection();
                        c.setConnectTimeout(20000); c.setReadTimeout(60000);
                        int code = c.getResponseCode();
                        java.util.Map<String, String> h = new java.util.HashMap<>();
                        h.put("Access-Control-Allow-Origin", "*");
                        java.io.InputStream in = code < 400 ? c.getInputStream() : c.getErrorStream();
                        String msg = c.getResponseMessage(); if (msg == null || msg.isEmpty()) msg = "OK";
                        return new WebResourceResponse("audio/mpeg", null, code, msg, h, in);
                    } catch (Exception e) { return null; }
                }
                return loader.shouldInterceptRequest(u);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if ("appassets.androidplatform.net".equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }
        });

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        initTts(null);
        if (b != null) web.restoreState(b);
        else web.loadUrl(HOME);
    }

    private final UtteranceProgressListener ttsListener = new UtteranceProgressListener() {
        @Override public void onStart(String id) { }
        @Override public void onDone(String id) { ttsDone(id); }
        @Override public void onError(String id) { ttsErr("speak"); }
        @Override public void onError(String id, int code) { ttsErr("speak"); }
        @Override public void onStop(String id, boolean interrupted) { }
    };

    /** تهيئة المحرك؛ إن لم يدعم المحرك الافتراضي العربية وكان محرك Google مثبتًا استُعمل محرك Google */
    private void initTts(final String engine) {
        ttsReady = false; ttsInitDone = false;
        TextToSpeech.OnInitListener onInit = status -> {
            boolean ok = (status == TextToSpeech.SUCCESS);
            if (ok && engine == null) {
                try {
                    if (tts.isLanguageAvailable(new Locale("ar")) < TextToSpeech.LANG_AVAILABLE) {
                        for (TextToSpeech.EngineInfo e : tts.getEngines()) {
                            if ("com.google.android.tts".equals(e.name) && !e.name.equals(tts.getDefaultEngine())) {
                                tts.shutdown(); initTts(e.name); return;
                            }
                        }
                    }
                } catch (Exception ignored) { }
            }
            ttsReady = ok; ttsInitDone = true;
        };
        tts = (engine == null) ? new TextToSpeech(this, onInit) : new TextToSpeech(this, onInit, engine);
        tts.setOnUtteranceProgressListener(ttsListener);
    }

    private void ttsErr(final String code) {
        if (web == null) return;
        web.post(() -> web.evaluateJavascript("window.__ttsErr && window.__ttsErr('" + code.replaceAll("[^a-z]", "") + "')", null));
    }

    private void ttsDone(final String id) {
        if (web == null) return;
        web.post(() -> web.evaluateJavascript("window.__ttsDone && window.__ttsDone('" + id.replaceAll("[^0-9]", "") + "')", null));
    }

    @Override
    protected void onDestroy() {
        if (tts != null) { tts.stop(); tts.shutdown(); }
        if (web != null) web.destroy();
        super.onDestroy();
    }

    /** البحث بالصوت والقراءة الصوتية */
    public class Bridge {
        @JavascriptInterface
        public void ttsSpeak(String text, String lang, float rate, String id) {
            if (!ttsReady) { ttsErr(ttsInitDone ? "noengine" : "notready"); return; }
            int r = tts.setLanguage(new Locale(lang));
            if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) { ttsErr("nolang"); return; }
            tts.setSpeechRate(rate);
            if (tts.speak(text, TextToSpeech.QUEUE_FLUSH, new Bundle(), id) == TextToSpeech.ERROR) ttsErr("speak");
        }

        @JavascriptInterface
        public void ttsStop() { if (tts != null) tts.stop(); }

        @JavascriptInterface
        public void ttsAwake(final boolean on) { runOnUiThread(() -> web.setKeepScreenOn(on)); }

        @JavascriptInterface
        public void ttsInstallEngine() {
            runOnUiThread(() -> {
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=com.google.android.tts"))); }
                catch (Exception e) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=com.google.android.tts"))); } catch (Exception ignored) { }
                }
            });
        }

        @JavascriptInterface
        public void ttsSettings() {
            runOnUiThread(() -> {
                try { startActivity(new Intent("com.android.settings.TTS_SETTINGS")); }
                catch (Exception e) {
                    try { startActivity(new Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA)); } catch (Exception ignored) { }
                }
            });
        }

        @JavascriptInterface
        public void voiceSearch(final String lang) {
            runOnUiThread(() -> {
                Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
                i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, lang);
                i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
                try { startActivityForResult(i, VOICE); }
                catch (Exception e) { web.evaluateJavascript("window.__voiceErr && window.__voiceErr('none')", null); }
            });
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == VOICE) {
            String text = "";
            if (resultCode == RESULT_OK && data != null) {
                ArrayList<String> r = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
                if (r != null && !r.isEmpty()) text = r.get(0);
            }
            final String js = text.isEmpty() ? "window.__voiceErr && window.__voiceErr('')" : "window.__voice && window.__voice(" + JSONObject.quote(text) + ")";
            web.post(() -> web.evaluateJavascript(js, null));
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }

    @Override
    public void onBackPressed() {
        // زر الرجوع: من القسم إلى الصفحة الرئيسية، ومنها يخرج التطبيق
        web.evaluateJavascript("(function(){var b=document.getElementById('back');var s=document.getElementById('sheet');if(s&&!s.hidden){s.hidden=true;return 1}if(b&&!b.hidden){b.click();return 1}return 0})()",
                v -> { if (!"1".equals(v)) MainActivity.super.onBackPressed(); });
    }
}
