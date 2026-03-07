// NOTE: this code is AI generated, so don't put much weight on the implementation details,
// such as the architectural decision to put this code straight in the desktop-app folder.

#include <node_api.h>

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#endif

static napi_value SendRelativeMouseMove(napi_env env, napi_callback_info info) {
#ifdef _WIN32
    size_t argc = 2;
    napi_value argv[2];
    napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);

    LONG dx = 1;
    LONG dy = 0;

    if (argc >= 1) {
        double value = 0;
        if (napi_get_value_double(env, argv[0], &value) == napi_ok) {
            dx = (LONG)value;
        }
    }
    if (argc >= 2) {
        double value = 0;
        if (napi_get_value_double(env, argv[1], &value) == napi_ok) {
            dy = (LONG)value;
        }
    }

    INPUT input;
    ZeroMemory(&input, sizeof(INPUT));
    input.type = INPUT_MOUSE;
    input.mi.dx = dx;
    input.mi.dy = dy;
    input.mi.mouseData = 0;
    input.mi.dwFlags = MOUSEEVENTF_MOVE;
    input.mi.time = 0;
    input.mi.dwExtraInfo = 0;

    UINT sent = SendInput(1, &input, sizeof(INPUT));
    if (sent != 1) {
        // Ignore failure; there may not be a desktop yet.
    }
#else
    (void)env;
    (void)info;
#endif

    napi_value undefined;
    napi_get_undefined(env, &undefined);
    return undefined;
}

static napi_value Init(napi_env env, napi_value exports) {
    napi_value fn;
    napi_create_function(env, "sendRelativeMouseMove", NAPI_AUTO_LENGTH, SendRelativeMouseMove, nullptr, &fn);
    napi_set_named_property(env, exports, "sendRelativeMouseMove", fn);
    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
