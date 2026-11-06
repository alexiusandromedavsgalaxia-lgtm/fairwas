package com.fairwas.android

import android.content.Context
import org.json.JSONArray

/** Persistent browser history and bookmarks with deterministic ordering. */
class BrowserStore(context: Context) {
    private val prefs = context.getSharedPreferences("fairwas_browser", Context.MODE_PRIVATE)

    @Synchronized
    fun history(): List<String> = readOrdered("history")

    @Synchronized
    fun bookmarks(): List<String> = readOrdered("bookmarks")

    @Synchronized
    fun record(url: String) {
        if (url.isBlank()) return
        val entries = readOrdered("history").toMutableList()
        entries.remove(url)
        entries.add(0, url)
        writeOrdered("history", entries.take(MAX_HISTORY))
    }

    @Synchronized
    fun toggleBookmark(url: String): Boolean {
        if (url.isBlank()) return false
        val entries = readOrdered("bookmarks").toMutableList()
        val added = if (url in entries) {
            entries.remove(url)
            false
        } else {
            entries.add(0, url)
            true
        }
        writeOrdered("bookmarks", entries)
        return added
    }

    @Synchronized
    fun isBookmarked(url: String): Boolean = url in readOrdered("bookmarks")

    private fun readOrdered(key: String): List<String> {
        val raw = prefs.getString(key, null) ?: return emptyList()
        return try {
            val json = JSONArray(raw)
            buildList {
                for (index in 0 until json.length()) {
                    val value = json.optString(index)
                    if (value.isNotBlank() && value !in this) add(value)
                }
            }
        } catch (_: Exception) {
            // Migrate data written by the previous StringSet implementation.
            val legacy = prefs.getStringSet(key, emptySet()).orEmpty().toList()
            writeOrdered(key, legacy)
            legacy
        }
    }

    private fun writeOrdered(key: String, values: List<String>) {
        val json = JSONArray()
        values.forEach(json::put)
        prefs.edit().putString(key, json.toString()).apply()
    }

    private companion object {
        const val MAX_HISTORY = 500
    }
}
