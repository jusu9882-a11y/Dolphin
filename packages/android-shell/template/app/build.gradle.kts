plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "com.dolphin.app"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.dolphin.app"
        minSdk = 23
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }
    val releaseStoreFile = System.getenv("DOLPHIN_KEYSTORE_PATH")
    val releaseStorePassword = System.getenv("DOLPHIN_KEYSTORE_PASSWORD")
    val releaseKeyAlias = System.getenv("DOLPHIN_KEY_ALIAS")
    val releaseKeyPassword = System.getenv("DOLPHIN_KEY_PASSWORD")
    if (!releaseStoreFile.isNullOrBlank() && !releaseStorePassword.isNullOrBlank()
        && !releaseKeyAlias.isNullOrBlank() && !releaseKeyPassword.isNullOrBlank()) {
        signingConfigs {
            create("release") {
                storeFile = file(releaseStoreFile)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }
    buildTypes {
        getByName("release") {
            if (!releaseStoreFile.isNullOrBlank() && !releaseStorePassword.isNullOrBlank()
                && !releaseKeyAlias.isNullOrBlank() && !releaseKeyPassword.isNullOrBlank()) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { buildConfig = true }
}
dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}
