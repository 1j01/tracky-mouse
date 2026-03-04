#include <node_api.h>

#ifdef _WIN32
#include <windows.h>
#endif

static napi_value EnsureCursorVisible(napi_env env, napi_callback_info info) {
#ifdef _WIN32
    // Trigger a tiny relative mouse move to make the cursor visible after logon
    // when Tracky Mouse is started via "Run at login".
    // Note: calling ShowCursor() does NOT fix the invisible cursor issue (tested).
    INPUT inputs[2] = {};

    inputs[0].type = INPUT_MOUSE;
    inputs[0].mi.dx = 1;
    inputs[0].mi.dy = 0;
    inputs[0].mi.dwFlags = MOUSEEVENTF_MOVE;

    inputs[1].type = INPUT_MOUSE;
    inputs[1].mi.dx = -1;
    inputs[1].mi.dy = 0;
    inputs[1].mi.dwFlags = MOUSEEVENTF_MOVE;

    UINT sent = SendInput(2, inputs, sizeof(INPUT));
    bool success = (sent == 2);
#else
    bool success = false;
#endif

    napi_value result;
    napi_status status = napi_get_boolean(env, success, &result);
    if (status != napi_ok) {
        napi_get_undefined(env, &result);
    }
    return result;
}

static napi_value Init(napi_env env, napi_value exports) {
    napi_value fn;
    napi_status status = napi_create_function(env, nullptr, 0, EnsureCursorVisible, nullptr, &fn);
    if (status != napi_ok) {
        return exports;
    }

    status = napi_set_named_property(env, exports, "ensureCursorVisible", fn);
    if (status != napi_ok) {
        return exports;
    }

    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
