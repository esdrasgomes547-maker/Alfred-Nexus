package com.example.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val AlfredColorScheme = darkColorScheme(
    primary      = AlfredBrass,
    onPrimary    = AlfredVoid,
    secondary    = AlfredBrassBright,
    onSecondary  = AlfredVoid,
    tertiary     = AlfredBrassDim,
    background   = AlfredVoid,
    surface      = AlfredObsidian,
    onBackground = AlfredText,
    onSurface    = AlfredText,
    outline      = AlfredSteel,
    error        = AlfredDanger,
    onError      = AlfredText,
)

@Composable
fun MyApplicationTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = AlfredColorScheme,
        typography  = Typography,
        content     = content,
    )
}
