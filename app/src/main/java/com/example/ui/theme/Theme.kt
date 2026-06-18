package com.example.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val AlfredColorScheme = darkColorScheme(
    primary       = GoldAccent,
    onPrimary     = PianoBlack,
    secondary     = GoldBright,
    onSecondary   = PianoBlack,
    tertiary      = GoldDim,
    background    = PianoBlack,
    surface       = EbonyDeep,
    onBackground  = IvoryWhite,
    onSurface     = IvoryWhite,
    outline       = EbonyBorder,
    error         = DangerRed,
    onError       = IvoryWhite,
)

@Composable
fun MyApplicationTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = AlfredColorScheme,
        typography  = Typography,
        content     = content,
    )
}
