#include "ipc.h"

Napi::Object IPC::Init(Napi::Env env) {

    Napi::Function func = DefineClass(env, "IPC",
                                      {
                                              InstanceMethod("getPID", &IPC::GetPID),
                                              InstanceMethod("getMainThreadId", &IPC::GetMainThreadId),
                                              InstanceMethod("getMessageThreadId", &IPC::GetMessageThreadId),
                                              InstanceMethod("waitThread", &IPC::WaitThread),
                                              InstanceMethod("on", &IPC::On),
                                              InstanceMethod("send", &IPC::Send),
                                      });

    Napi::FunctionReference *constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);
    env.SetInstanceData(constructor);

    return func;
}

static long thread_id_number(std::thread::id threadId) {
    std::stringstream ss;
    ss << threadId;
    return std::stoull(ss.str());
}

IPC::IPC(const Napi::CallbackInfo &info)
        : Napi::ObjectWrap<IPC>(info) {
    pid = GetCurrentProcessId();
    mainThreadId = thread_id_number(std::this_thread::get_id());
    nativeThreadTerminated = true;
}

IPC::~IPC() {

}

Napi::Value IPC::GetPID(const Napi::CallbackInfo &args) {
    Napi::Env env = args.Env();
    return Napi::Number::New(env, pid);
}

Napi::Value IPC::GetMainThreadId(const Napi::CallbackInfo &args) {
    Napi::Env env = args.Env();
    return Napi::Number::New(env, mainThreadId);
}

Napi::Value IPC::GetMessageThreadId(const Napi::CallbackInfo &args) {
    Napi::Env env = args.Env();
    return Napi::Number::New(env, messageThreadId);
}

Napi::Value IPC::WaitThread(const Napi::CallbackInfo &args) {
    Napi::Env env = args.Env();
    this->StopMessageThread();
    return Napi::Number::New(env, 1);
}

Napi::Value IPC::Send(const Napi::CallbackInfo &args) {
    Napi::Env env = args.Env();

    if (args.Length() < 4) {
        Napi::TypeError::New(env, "Not enough arguments to IPC.send").ThrowAsJavaScriptException();
        return Napi::Number::New(env, -1);
    }

    if (!(args[0].IsNumber() &&
          args[1].IsNumber() &&
          args[2].IsNumber() &&
          args[3].IsNumber()
    )) {
        Napi::TypeError::New(env, "Wrong type arguments to IPC.send").ThrowAsJavaScriptException();
        return Napi::Number::New(env, -1);
    }

    DWORD recieverThreadId = args[0].As<Napi::Number>().DoubleValue();
    DWORD message = args[1].As<Napi::Number>().DoubleValue();
    DWORD wParam = args[2].As<Napi::Number>().DoubleValue();
    DWORD lParam = args[3].As<Napi::Number>().DoubleValue();

    PostThreadMessage(recieverThreadId, message, wParam, lParam);

    return Napi::Number::New(env, 1);
}


/*
Napi::Value IPC::OnMessage2(const Napi::CallbackInfo &args) {
    Napi::Env env = args.Env();

    if (args.Length() < 1) {
        Napi::TypeError::New(env, "Not enough arguments to IPC.onMessage").ThrowAsJavaScriptException();
        return Napi::Number::New(env, -1);
    }

    messageCallback = args[0].As<Napi::Function>();

    BOOL bRet;
    MSG msg;

    while ((bRet = GetMessage(&msg, 0, 0, 0)) != 0) {
        if (bRet == -1) {
            bRet = HRESULT_FROM_WIN32(GetLastError());
            messageCallback.Call(env.Global(), {Napi::String::New(env, "Hurr  i am the error")});
            break;
        } else {
            messageCallback.Call(env.Global(),
                                 {Napi::Number::New(env, msg.wParam), Napi::Number::New(env, msg.lParam)});
        }
    }

    return Napi::Number::New(env, 1);
}
*/

Napi::Value IPC::On(const Napi::CallbackInfo &args) {
    Napi::Env env = args.Env();

    if (args.Length() < 2) {
        Napi::TypeError::New(env, "Not enough arguments to IPC.on").ThrowAsJavaScriptException();
        return Napi::Number::New(env, -1);
    }

    if (!(args[0].IsString() &&
          args[1].IsFunction())) {
        Napi::TypeError::New(env, "Wrong type arguments to IPC.on").ThrowAsJavaScriptException();
        return Napi::Number::New(env, -1);
    }

    const std::string eventType = args[0].As<Napi::String>().Utf8Value();
    const Napi::Function callback = args[1].As<Napi::Function>();

    // https://github.com/nodejs/node-addon-api/blob/master/doc/threadsafe_function.md

    // Create a ThreadSafeFunction
    tsfn = Napi::ThreadSafeFunction::New(
            env,
            callback,  // JavaScript function called asynchronously
            "OnMessage",         // Name
            0,                       // Unlimited queue
            1,                       // Only one thread will use this initially
            [this](Napi::Env) {        // Finalizer used to clean threads up
                //this->nativeThread.join();
            });

    this->StartMessageThread();

    //std::thread thread(&IPC::OnMessage, this, env, callback);
    //thread.join();
    //OnMessage(env, callback);

    return Napi::Number::New(env, 1);
}

struct message {
    double message;
    double wParam;
    double lParam;
};

void IPC::StartMessageThread() {
    // Create a native thread
    nativeThreadTerminated = false;
    nativeThread = std::thread([this] {
        this->messageThreadId = thread_id_number(std::this_thread::get_id());
        auto callback = [](Napi::Env env, Napi::Function jsCallback, MSG *value) {
            // Transform native data into JS data, passing it to the provided
            // `jsCallback` -- the TSFN's JavaScript function.
            Napi::Object messageObj = Napi::Object::New(env);
            messageObj.Set("message", Napi::Number::New(env, value->message));
            messageObj.Set("wParam", Napi::Number::New(env, value->wParam));
            messageObj.Set("lParam", Napi::Number::New(env, value->lParam));

            jsCallback.Call({messageObj});
        };

        BOOL bRet;
        MSG msg;
        while ((bRet = GetMessage(&msg, 0, 0, 0)) != 0) {
            // Perform a blocking call
            napi_status status = tsfn.BlockingCall(&msg, callback);
            if (status != napi_ok) {
                // Handle error
                break;
            }

            if (this->nativeThreadTerminated == true && msg.message == WM_QUIT) {
                break;
            }
        }

        // Release the thread-safe function
        tsfn.Release();
    });
}

void IPC::StopMessageThread() {
    this->nativeThreadTerminated = true;
    PostThreadMessage(thread_id_number(nativeThread.get_id()), WM_QUIT, 0, 0);
    this->nativeThread.join();
}

void IPC::OnMessage(Napi::Env env, Napi::Function callback) {
    callback.Call(env.Global(), {Napi::String::New(env, "Hello from onMessage method!")});
}
