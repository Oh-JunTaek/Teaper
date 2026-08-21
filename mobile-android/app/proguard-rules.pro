# LiteRT-LM의 JNI 진입점은 런타임에서 사용되므로 출시 빌드 최적화 도입 시 유지 규칙을 검증한다.
-keep class com.google.ai.edge.litertlm.** { *; }
