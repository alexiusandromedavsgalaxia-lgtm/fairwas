package com.fairwas.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class HttcClientTest {
    private val client = HttcClient("https://example.test")

    @Test
    fun normalizesHttpUrlsWithoutLosingEscapedPathOrQuery() {
        assertEquals(
            "httc://example.com/path%20with%20spaces?q=hello%20world#section",
            client.normalize("https://example.com/path%20with%20spaces?q=hello%20world#section")
        )
    }

    @Test
    fun rejectsEmptyAndInvalidAddresses() {
        assertTrue(runCatching { client.normalize("  ") }.isFailure)
        assertTrue(runCatching { client.normalize("httc:///missing-host") }.isFailure)
    }

    @Test
    fun acceptsHttcHostsAndPorts() {
        assertEquals("httc://demo.fair:8080/page", client.normalize("httc://demo.fair:8080/page"))
    }
}

class YourCodeParserTest {
    @Test
    fun comparisonsDoNotCreateUnclosedGroupDiagnostics() {
        val result = YourCodeParser.parse("a < b && c > d")
        assertTrue(result.diagnostics.isEmpty())
        assertTrue(result.tokens.any { it.kind == YourCodeParser.Kind.OPERATOR && it.text.contains("<") })
    }

    @Test
    fun nestedGroupsAreBalanced() {
        val result = YourCodeParser.parse("call(items[0], { value: 2 })")
        assertTrue(result.diagnostics.isEmpty())
    }

    @Test
    fun reportsUnclosedStringsAndComments() {
        val result = YourCodeParser.parse("\"unfinished")
        assertTrue(result.diagnostics.any { it.message == "Cadena sin cerrar" })
        val comment = YourCodeParser.parse("/* unfinished")
        assertTrue(comment.diagnostics.any { it.message == "Comentario sin cerrar" })
    }
}
