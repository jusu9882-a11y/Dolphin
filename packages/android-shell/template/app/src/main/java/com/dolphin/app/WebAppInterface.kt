package com.dolphin.app

import android.content.Context
import android.os.BatteryManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.webkit.WebView
import android.widget.Toast
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class WebAppInterface(private val context: Context, private val webView: WebView) {
    private val appFiles = File(context.filesDir, "dolphin").apply { mkdirs() }
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    fun handleMessage(raw: String) {
        val request = try { JSONObject(raw) } catch (_: Exception) { return }
        val id = request.optString("id")
        val method = request.optString("method")
        val params = request.optJSONObject("params") ?: JSONObject()
        if (id.isBlank() || id.length > 128) return

        scope.launch {
            try {
                when (method) {
                    "device.vibrate" -> {
                        val duration = params.optLong("durationMs", 100L)
                        require(duration in 0L..10_000L) { "Invalid vibration duration" }
                        val vibrator = if (Build.VERSION.SDK_INT >= 31) {
                            (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
                        } else {
                            @Suppress("DEPRECATION")
                            context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                        }
                        if (Build.VERSION.SDK_INT >= 26) vibrator.vibrate(VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE))
                        else {
                            @Suppress("DEPRECATION")
                            vibrator.vibrate(duration)
                        }
                        success(id, JSONObject.NULL)
                    }
                    "device.getSensorData" -> {
                        val sensorName = params.optString("sensor")
                        val sensorType = when (sensorName) {
                            "accelerometer" -> Sensor.TYPE_ACCELEROMETER
                            "gyroscope" -> Sensor.TYPE_GYROSCOPE
                            "magnetometer" -> Sensor.TYPE_MAGNETIC_FIELD
                            "light" -> Sensor.TYPE_LIGHT
                            "proximity" -> Sensor.TYPE_PROXIMITY
                            else -> throw IllegalArgumentException("Unsupported sensor")
                        }
                        success(id, readSensor(sensorType))
                    }
                    "device.getInfo" -> {
                        val battery = context.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
                        val level = battery.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY).coerceIn(0, 100)
                        val result = JSONObject()
                            .put("model", "${Build.MANUFACTURER} ${Build.MODEL}")
                            .put("osVersion", Build.VERSION.RELEASE ?: "unknown")
                            .put("batteryLevel", level)
                        success(id, result)
                    }
                    "ui.showToast" -> {
                        val message = params.optString("message")
                        require(message.length <= 500) { "Message too long" }
                        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
                        success(id, JSONObject.NULL)
                    }
                    "fs.readFile" -> {
                        val content = withContext(Dispatchers.IO) {
                            val file = safeFile(params.optString("path"))
                            require(file.isFile) { "File not found" }
                            require(file.length() <= 1_048_576) { "File exceeds 1 MiB limit" }
                            file.readText(Charsets.UTF_8)
                        }
                        success(id, content)
                    }
                    "fs.writeFile" -> {
                        withContext(Dispatchers.IO) {
                            val file = safeFile(params.optString("path"))
                            val data = params.optString("data")
                            require(data.toByteArray(Charsets.UTF_8).size <= 1_048_576) { "File exceeds 1 MiB limit" }
                            file.parentFile?.mkdirs()
                            file.writeText(data, Charsets.UTF_8)
                        }
                        success(id, JSONObject.NULL)
                    }
                    else -> throw IllegalArgumentException("Unknown method")
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                failure(id, "NATIVE_ERROR", e.message ?: "Native operation failed")
            }
        }
    }


    private suspend fun readSensor(type: Int): JSONObject {
        val manager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        val sensor = manager.getDefaultSensor(type)
            ?: throw IllegalStateException("Requested sensor is not available on this device")
        val reading = withTimeoutOrNull(2_000L) {
            suspendCancellableCoroutine { continuation ->
                val listener = object : SensorEventListener {
                    override fun onSensorChanged(event: SensorEvent) {
                        if (!continuation.isActive) return
                        val values = org.json.JSONArray()
                        event.values.forEach { values.put(it.toDouble()) }
                        val result = JSONObject()
                            .put("sensor", sensor.name)
                            .put("type", sensor.stringType)
                            .put("values", values)
                            .put("accuracy", event.accuracy)
                            .put("timestampNanos", event.timestamp)
                        manager.unregisterListener(this)
                        continuation.resume(result)
                    }
                    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
                }
                continuation.invokeOnCancellation { manager.unregisterListener(listener) }
                if (!manager.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL)) {
                    continuation.resumeWithException(
                        IllegalStateException("Unable to register sensor listener")
                    )
                }
            }
        }
        return reading ?: throw IllegalStateException("Sensor did not provide a reading in time")
    }

    fun close() {
        scope.cancel()
    }

    private fun safeFile(relative: String): File {
        require(relative.isNotBlank() && relative.length <= 240) { "Invalid file path" }
        val base = appFiles.canonicalFile
        val target = File(base, relative).canonicalFile
        require(target.path.startsWith(base.path + File.separator)) { "Path escapes app storage" }
        return target
    }

    private fun success(id: String, result: Any?) =
        respond(JSONObject().put("id", id).put("result", result))

    private fun failure(id: String, code: String, message: String) =
        respond(JSONObject().put("id", id).put("error", JSONObject().put("code", code).put("message", message)))

    private fun respond(json: JSONObject) {
        val payload = JSONObject.quote(json.toString())
        webView.post { webView.evaluateJavascript("window.__dolphinResolve && window.__dolphinResolve($payload);", null) }
    }
}
