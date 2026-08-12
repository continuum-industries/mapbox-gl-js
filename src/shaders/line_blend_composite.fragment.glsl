uniform highp sampler2D u_image;
uniform float u_opacity;
uniform int u_blend_mode;
uniform highp float u_max_density;
in vec2 v_pos;

#define ADDITIVE 1

void main() {
    vec4 color = texture(u_image, v_pos);

    if (u_blend_mode == ADDITIVE) {
        // Additive mode: FBO is cleared to transparent black and alpha=0 means
        // untouched, so discard those pixels.
        if (color.a <= 0.0) {
            discard;
        }

        // The FBO accumulates coverage-weighted colour and unbounded density:
        //   RGB: SRC_ALPHA * src + dst  →  sum of (opacity * color) per line
        //   Alpha: ONE * src + ONE * dst  →  sum of per-line opacities (density)
        //
        // Recover the average line colour by dividing out the accumulated alpha.
        highp float density = color.a;
        vec3 avgColor = color.rgb / max(density, 0.001);

        // Normalise density against the anchor value and apply a smooth power
        // curve that never hard-saturates:
        //
        //   n = density / u_max_density
        //   t = (n / (n + 1)) ^ 0.5
        //
        // Unlike the previous Reinhard × 2 approach, this curve asymptotically
        // approaches 1.0 rather than clamping to it — so the full density range
        // always expresses visible variation regardless of dataset size:
        //
        //   n = 0.25  →  t ≈ 0.45   (sparse)
        //   n = 1.00  →  t ≈ 0.71   (at anchor)
        //   n = 4.00  →  t ≈ 0.89   (dense)
        //   n = 100   →  t ≈ 0.99   (very dense, never fully clips)
        //
        // This means the exact value of u_max_density matters much less —
        // shifting it by a constant factor just slides the curve along the
        // density axis without crushing the contrast at the top end.
        highp float n = density / max(u_max_density, 0.001);
        highp float t = sqrt(n / (n + 1.0));

        glFragColor = vec4(avgColor * t, t);
    } else {
        // Multiply mode: the FBO is cleared to opaque white (1,1,1,1) and each
        // line fragment outputs its per-pixel multiply factor. The FBO accumulates
        // these via ColorMode.multiply (DST_COLOR * ZERO), so color.rgb already
        // holds the combined product of all line factors, with alpha=1 throughout.
        //
        // A pixel untouched by any line retains the clear value (1,1,1,1), which
        // is a no-op under ColorMode.multiply composite — no discard needed.
        //
        // Scale the factor toward 1.0 (no-op) by u_opacity so that line-opacity
        // modulates the strength of the multiply effect:
        //   final_factor = lerp(1, fbo_factor, opacity) = fbo_factor*opacity + (1-opacity)
        vec3 multiplyFactor = color.rgb * u_opacity + (1.0 - u_opacity);
        glFragColor = vec4(multiplyFactor, 1.0);
    }

#ifdef OVERDRAW_INSPECTOR
    glFragColor = vec4(0.0);
#endif

    HANDLE_WIREFRAME_DEBUG;
}
