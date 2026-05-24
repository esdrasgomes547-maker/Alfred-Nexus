package com.example.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext

private val DarkColorScheme =
  darkColorScheme(
    primary = CyberCyan,
    secondary = ActiveGreen,
    tertiary = SmoothTeal,
    background = CyberBlack,
    surface = ObsidianDark,
    onPrimary = CyberBlack,
    onSecondary = CyberBlack,
    onBackground = PureWhite,
    onSurface = PureWhite
  )

private val LightColorScheme = DarkColorScheme // Enforce stunning terminal theme in light mode too

@Composable
fun MyApplicationTheme(
  darkTheme: Boolean = true, // Force visual terminal aesthetic
  dynamicColor: Boolean = false, // Avoid random system overrides to preserve premium styling
  content: @Composable () -> Unit,
) {
  val colorScheme = DarkColorScheme

  MaterialTheme(colorScheme = colorScheme, typography = Typography, content = content)
}
