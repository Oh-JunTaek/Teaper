import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.eunmastudio.teacherworkspace"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.eunmastudio.teacherworkspace"
        minSdk = 29
        targetSdk = 36
        versionCode = 26
        versionName = "0.1.0-alpha.26"
        // 결제를 연결하기 전에는 서명 배포 과정에서만 플랜을 정한다. 기본값은 basic이며 -PeunmaOutputPlan=plus로 플러스 배포본을 만든다.
        manifestPlaceholders["eunmaOutputPlan"] = providers.gradleProperty("eunmaOutputPlan").orElse("basic").get()

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.activity:activity-ktx:1.10.0")
    implementation("androidx.biometric:biometric:1.1.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-process:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.8.7")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("com.tom-roush:pdfbox-android:2.0.27.0")

    // Android 컴파일로 검증한 LiteRT-LM 런타임. 출시 전에는 자동 최신 버전을 사용하지 않는다.
    implementation("com.google.ai.edge.litertlm:litertlm-android:0.16.1")

    testImplementation("junit:junit:4.13.2")
}
