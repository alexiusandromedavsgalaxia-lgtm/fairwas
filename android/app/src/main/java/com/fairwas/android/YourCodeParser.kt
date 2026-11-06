package com.fairwas.android

/**
 * Lightweight universal lexer for unknown/custom languages.
 * It deliberately reports structure, not invented language semantics.
 */
object YourCodeParser {
    enum class Kind { IDENTIFIER, NUMBER, STRING, OPERATOR, COMMENT, OPEN_GROUP, CLOSE_GROUP, WHITESPACE, UNKNOWN }
    data class Token(val kind: Kind, val text: String, val line: Int, val column: Int)
    data class Diagnostic(val message: String, val line: Int, val column: Int)
    data class Result(val tokens: List<Token>, val diagnostics: List<Diagnostic>)

    fun parse(source: String): Result {
        val tokens = mutableListOf<Token>()
        val diagnostics = mutableListOf<Diagnostic>()
        val groups = ArrayDeque<Token>()
        var i = 0
        var line = 1
        var column = 1

        fun advance(): Char {
            val c = source[i++]
            if (c == '\n') { line++; column = 1 } else column++
            return c
        }
        fun add(kind: Kind, start: Int, startLine: Int, startColumn: Int) {
            tokens += Token(kind, source.substring(start, i), startLine, startColumn)
        }
        val opening = setOf('(', '[', '{', '<')
        val closing = setOf(')', ']', '}', '>')
        val pairs = mapOf(')' to '(', ']' to '[', '}' to '{', '>' to '<')

        while (i < source.length) {
            val start = i
            val startLine = line
            val startColumn = column
            val c = source[i]

            when {
                c.isWhitespace() -> {
                    while (i < source.length && source[i].isWhitespace()) advance()
                    add(Kind.WHITESPACE, start, startLine, startColumn)
                }
                c == '/' && i + 1 < source.length && source[i + 1] == '/' -> {
                    while (i < source.length && advance() != '\n') Unit
                    add(Kind.COMMENT, start, startLine, startColumn)
                }
                c == '#' -> {
                    while (i < source.length && advance() != '\n') Unit
                    add(Kind.COMMENT, start, startLine, startColumn)
                }
                c == '/' && i + 1 < source.length && source[i + 1] == '*' -> {
                    advance(); advance()
                    var closed = false
                    while (i < source.length) {
                        if (source[i] == '*' && i + 1 < source.length && source[i + 1] == '/') {
                            advance(); advance(); closed = true; break
                        }
                        advance()
                    }
                    add(Kind.COMMENT, start, startLine, startColumn)
                    if (!closed) diagnostics += Diagnostic("Comentario sin cerrar", startLine, startColumn)
                }
                c == '"' || c == '\'' || c == '`' -> {
                    val quote = advance()
                    var closed = false
                    while (i < source.length) {
                        val next = advance()
                        if (next == '\\' && i < source.length) advance()
                        else if (next == quote) { closed = true; break }
                    }
                    add(Kind.STRING, start, startLine, startColumn)
                    if (!closed) diagnostics += Diagnostic("Cadena sin cerrar", startLine, startColumn)
                }
                c.isLetter() || c == '_' || c == '$' -> {
                    advance()
                    while (i < source.length && (source[i].isLetterOrDigit() || source[i] == '_' || source[i] == '$')) advance()
                    add(Kind.IDENTIFIER, start, startLine, startColumn)
                }
                c.isDigit() -> {
                    advance()
                    while (i < source.length && (source[i].isLetterOrDigit() || source[i] == '.' || source[i] == '_')) advance()
                    add(Kind.NUMBER, start, startLine, startColumn)
                }
                c in opening -> {
                    advance()
                    val token = Token(Kind.OPEN_GROUP, source.substring(start, i), startLine, startColumn)
                    tokens += token
                    groups.addLast(token)
                }
                c in closing -> {
                    advance()
                    tokens += Token(Kind.CLOSE_GROUP, source.substring(start, i), startLine, startColumn)
                    val expected = pairs[c]
                    if (groups.isEmpty()) diagnostics += Diagnostic("Cierre sin apertura: $c", startLine, startColumn)
                    else if (groups.last().text.first() == expected) groups.removeLast()
                    else diagnostics += Diagnostic("Cierre no coincidente: $c", startLine, startColumn)
                }
                else -> {
                    advance()
                    while (i < source.length && !source[i].isWhitespace() &&
                        !source[i].isLetterOrDigit() && source[i] !in opening &&
                        source[i] !in closing && source[i] !in listOf('"', '\'', '`', '#')) advance()
                    val kind = if (source.substring(start, i).any { it in "+-*/%=!&|^~?:;,.@" }) Kind.OPERATOR else Kind.UNKNOWN
                    add(kind, start, startLine, startColumn)
                }
            }
        }
        groups.reversed().forEach { diagnostics += Diagnostic("Grupo sin cerrar: " + it.text, it.line, it.column) }
        return Result(tokens, diagnostics)
    }
}
