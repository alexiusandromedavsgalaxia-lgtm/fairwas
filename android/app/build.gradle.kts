plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val configuredBaseUrl = providers.gradleProperty("fairwasBaseUrl")
    .orElse("https://fairwas.pages.dev")
    .get()
val escapedBaseUrl = configuredBaseUrl.replace("\\", "\\\\").replace("\"", "\\\"")

android {
    namespace = "com.fairwas.android"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.fairwas.android"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "0.2.0"
        buildConfigField("String", "FAIRWAS_BASE_URL", "\"$escapedBaseUrl\"")
    }

    buildFeatures { buildConfig = true }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions { jvmTarget = "17" }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    testImplementation("junit:junit:4.13.2")
}
