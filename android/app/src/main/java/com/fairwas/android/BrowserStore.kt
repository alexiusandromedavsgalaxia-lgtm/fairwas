package com.fairwas.android

import android.content.Context

/** Persistent browser history and bookmarks. */
class BrowserStore(context: Context) {
    private val prefs = context.getSharedPreferences("fairwas_browser", Context.MODE_PRIVATE)
    fun history(): List<String> = prefs.getStringSet("history", emptySet()).orEmpty().toList().reversed()
    fun bookmarks(): List<String> = prefs.getStringSet("bookmarks", emptySet()).orEmpty().toList()
    fun record(url: String) {
        val entries = prefs.getStringSet("history", emptySet()).orEmpty().toMutableSet()
        entries.remove(url); entries.add(url)
        prefs.edit().putStringSet("history", entries.takeLast(500).toSet()).apply()
    }
    fun toggleBookmark(url: String): Boolean {
        val entries = prefs.getStringSet("bookmarks", emptySet()).orEmpty().toMutableSet()
        val added = if (entries.contains(url)) { entries.remove(url); false } else { entries.add(url); true }
        prefs.edit().putStringSet("bookmarks", entries).apply()
        return added
    }
    fun isBookmarked(url: String) = prefs.getStringSet("bookmarks", emptySet()).orEmpty().contains(url)
}
