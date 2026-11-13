#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <mfapi.h>
#include <mfidl.h>
#include <mfreadwrite.h>
#include <gdiplus.h>
#include <shlwapi.h>
#include <stdio.h>
#include <string>
#include <vector>

#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "mfplat.lib")
#pragma comment(lib, "mfreadwrite.lib")
#pragma comment(lib, "mfuuid.lib")
#pragma comment(lib, "gdiplus.lib")
#pragma comment(lib, "shlwapi.lib")
#pragma comment(lib, "user32.lib")

static void Release(IUnknown* p)
{
    if (p) p->Release();
}

static void Hold()
{
    wprintf(L"\nKapatmak için Enter'a bas.\n");
    HANDLE input = GetStdHandle(STD_INPUT_HANDLE);
    if (input == NULL || input == INVALID_HANDLE_VALUE)
        return;
    wchar_t buf[8];
    DWORD got = 0;
    ReadConsoleW(input, buf, 4, &got, NULL);
}

static int PngClsid(CLSID* id)
{
    UINT count = 0;
    UINT bytes = 0;
    if (Gdiplus::GetImageEncodersSize(&count, &bytes) != Gdiplus::Ok || bytes == 0)
        return 0;
    std::vector<BYTE> buf(bytes);
    Gdiplus::ImageCodecInfo* info = (Gdiplus::ImageCodecInfo*)&buf[0];
    if (Gdiplus::GetImageEncoders(count, bytes, info) != Gdiplus::Ok)
        return 0;
    for (UINT i = 0; i < count; i++)
    {
        if (wcscmp(info[i].MimeType, L"image/png") == 0)
        {
            *id = info[i].Clsid;
            return 1;
        }
    }
    return 0;
}

static int SavePng(const std::wstring& path, const BYTE* bgra, UINT width, UINT height)
{
    Gdiplus::Bitmap bmp((INT)width, (INT)height, (INT)(width * 4), PixelFormat32bppARGB, (BYTE*)bgra);
    CLSID id;
    if (!PngClsid(&id))
        return 0;
    return bmp.Save(path.c_str(), &id, NULL) == Gdiplus::Ok;
}

static std::wstring ExeDir()
{
    wchar_t path[MAX_PATH];
    DWORD n = GetModuleFileNameW(NULL, path, MAX_PATH);
    if (n == 0 || n >= MAX_PATH)
        return L".";
    PathRemoveFileSpecW(path);
    return path;
}

static std::wstring BaseName(const std::wstring& path)
{
    const wchar_t* name = PathFindFileNameW(path.c_str());
    std::wstring s = name ? name : path;
    size_t dot = s.find_last_of(L'.');
    if (dot != std::wstring::npos)
        s.erase(dot);
    return s;
}

static void Collect(const std::wstring& dir, std::vector<std::wstring>& out)
{
    std::wstring spec = dir + L"\\*.mp4";
    WIN32_FIND_DATAW fd;
    HANDLE h = FindFirstFileW(spec.c_str(), &fd);
    if (h == INVALID_HANDLE_VALUE)
        return;
    do
    {
        if (fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY)
            continue;
        out.push_back(dir + L"\\" + fd.cFileName);
    } while (FindNextFileW(h, &fd));
    FindClose(h);
}

static void ClearKind(const std::wstring& dir, const wchar_t* kind)
{
    std::wstring spec = dir + L"\\" + kind;
    WIN32_FIND_DATAW fd;
    HANDLE h = FindFirstFileW(spec.c_str(), &fd);
    if (h == INVALID_HANDLE_VALUE)
        return;
    do
    {
        if (!(fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY))
            DeleteFileW((dir + L"\\" + fd.cFileName).c_str());
    } while (FindNextFileW(h, &fd));
    FindClose(h);
}

static int Split(const std::wstring& video, const std::wstring& folder)
{
    IMFAttributes* attr = NULL;
    IMFSourceReader* reader = NULL;
    IMFMediaType* type = NULL;
    IMFMediaType* current = NULL;
    HRESULT hr = MFCreateAttributes(&attr, 2);
    if (FAILED(hr))
        return 0;
    attr->SetUINT32(MF_READWRITE_ENABLE_HARDWARE_TRANSFORMS, FALSE);
    attr->SetUINT32(MF_SOURCE_READER_ENABLE_VIDEO_PROCESSING, TRUE);
    hr = MFCreateSourceReaderFromURL(video.c_str(), attr, &reader);
    Release(attr);
    if (FAILED(hr))
    {
        wprintf(L"Video açılamadı: %s\n", video.c_str());
        return 0;
    }
    reader->SetStreamSelection((DWORD)MF_SOURCE_READER_ALL_STREAMS, FALSE);
    reader->SetStreamSelection((DWORD)MF_SOURCE_READER_FIRST_VIDEO_STREAM, TRUE);
    hr = MFCreateMediaType(&type);
    if (SUCCEEDED(hr))
    {
        type->SetGUID(MF_MT_MAJOR_TYPE, MFMediaType_Video);
        type->SetGUID(MF_MT_SUBTYPE, MFVideoFormat_RGB32);
        type->SetUINT32(MF_MT_VIDEO_NOMINAL_RANGE, MFNominalRange_0_255);
        hr = reader->SetCurrentMediaType((DWORD)MF_SOURCE_READER_FIRST_VIDEO_STREAM, NULL, type);
        if (FAILED(hr))
        {
            type->DeleteItem(MF_MT_VIDEO_NOMINAL_RANGE);
            hr = reader->SetCurrentMediaType((DWORD)MF_SOURCE_READER_FIRST_VIDEO_STREAM, NULL, type);
        }
    }
    Release(type);
    if (FAILED(hr))
    {
        wprintf(L"Kare biçimi ayarlanamadı.\n");
        Release(reader);
        return 0;
    }
    hr = reader->GetCurrentMediaType((DWORD)MF_SOURCE_READER_FIRST_VIDEO_STREAM, &current);
    UINT32 width = 0;
    UINT32 height = 0;
    if (FAILED(hr) || FAILED(MFGetAttributeSize(current, MF_MT_FRAME_SIZE, &width, &height)) || width == 0 || height == 0)
    {
        wprintf(L"Video boyutu okunamadı.\n");
        Release(current);
        Release(reader);
        return 0;
    }
    LONG stride = (LONG)(width * 4);
    UINT32 rawStride = 0;
    if (SUCCEEDED(current->GetUINT32(MF_MT_DEFAULT_STRIDE, &rawStride)) && rawStride != 0)
        stride = (LONG)rawStride;
    else
    {
        LONG guessed = 0;
        if (SUCCEEDED(MFGetStrideForBitmapInfoHeader(MFVideoFormat_RGB32.Data1, width, &guessed)) && guessed != 0)
            stride = guessed;
    }
    Release(current);
    CreateDirectoryW(folder.c_str(), NULL);
    ClearKind(folder, L"*.jpg");
    ClearKind(folder, L"*.png");
    wprintf(L"%u x %u, her 0,5 saniye\n", width, height);
    wprintf(L"Klasör: %s\n", folder.c_str());
    const LONGLONG step = 5000000;
    LONGLONG next = 0;
    int saved = 0;
    int absStride = stride < 0 ? -stride : stride;
    std::vector<BYTE> top((size_t)width * height * 4);
    for (;;)
    {
        DWORD flags = 0;
        LONGLONG stamp = 0;
        IMFSample* sample = NULL;
        hr = reader->ReadSample((DWORD)MF_SOURCE_READER_FIRST_VIDEO_STREAM, 0, NULL, &flags, &stamp, &sample);
        if (FAILED(hr) || (flags & MF_SOURCE_READERF_ENDOFSTREAM))
        {
            Release(sample);
            break;
        }
        if (!sample)
            continue;
        if (stamp < next)
        {
            Release(sample);
            continue;
        }
        IMFMediaBuffer* buffer = NULL;
        if (FAILED(sample->ConvertToContiguousBuffer(&buffer)))
        {
            Release(sample);
            continue;
        }
        BYTE* data = NULL;
        DWORD maxLen = 0;
        DWORD curLen = 0;
        if (SUCCEEDED(buffer->Lock(&data, &maxLen, &curLen)) && data)
        {
            if (saved == 0 && height > 0 && curLen >= (DWORD)width * height * 4 && (curLen % height) == 0)
            {
                LONG row = (LONG)(curLen / height);
                if (row >= (LONG)width * 4)
                {
                    stride = row;
                    absStride = row;
                }
            }
            UINT need = (UINT)absStride * height;
            if (curLen >= need)
            {
                for (UINT y = 0; y < height; y++)
                {
                    const BYTE* row = (stride < 0)
                        ? data + (size_t)(height - 1 - y) * absStride
                        : data + (size_t)y * absStride;
                    BYTE* dest = &top[(size_t)y * width * 4];
                    memcpy(dest, row, width * 4);
                    for (UINT x = 0; x < width; x++)
                        dest[x * 4 + 3] = 255;
                }
                wchar_t name[32];
                swprintf(name, 32, L"%06d.png", saved + 1);
                std::wstring path = folder + L"\\" + name;
                if (SavePng(path, &top[0], width, height))
                {
                    saved++;
                    while (next <= stamp)
                        next += step;
                }
            }
            buffer->Unlock();
        }
        Release(buffer);
        Release(sample);
        if (saved > 0 && (saved % 10) == 0)
            wprintf(L"%d kare yazıldı\n", saved);
    }
    Release(reader);
    wprintf(L"Bitti. %d kare yazıldı.\n", saved);
    return saved;
}

int wmain(int argc, wchar_t** argv)
{
    SetConsoleOutputCP(CP_UTF8);
    HRESULT hr = CoInitializeEx(NULL, COINIT_APARTMENTTHREADED);
    if (FAILED(hr))
        return 1;
    hr = MFStartup(MF_VERSION, MFSTARTUP_LITE);
    if (FAILED(hr))
    {
        CoUninitialize();
        return 1;
    }
    Gdiplus::GdiplusStartupInput input;
    ULONG_PTR token = 0;
    if (Gdiplus::GdiplusStartup(&token, &input, NULL) != Gdiplus::Ok)
    {
        MessageBoxW(NULL, L"Görüntü kaydı başlatılamadı.", L"Kare Ayır", MB_OK | MB_ICONERROR);
        MFShutdown();
        CoUninitialize();
        Hold();
        return 1;
    }
    std::vector<std::wstring> videos;
    if (argc > 1)
        videos.push_back(argv[1]);
    else
        Collect(ExeDir(), videos);
    if (videos.empty())
    {
        const wchar_t* msg = L"Bu klasörde mp4 yok. Videoyu KareAyir.exe ile aynı klasöre koyup yeniden çalıştır.";
        wprintf(L"%s\n", msg);
        MessageBoxW(NULL, msg, L"Kare Ayır", MB_OK | MB_ICONINFORMATION);
    }
    else
    {
        int total = 0;
        for (size_t i = 0; i < videos.size(); i++)
        {
            std::wstring folder = videos[i];
            size_t dot = folder.find_last_of(L'.');
            if (dot != std::wstring::npos)
                folder.erase(dot);
            folder += L"_kareler";
            wprintf(L"Video: %s\n", videos[i].c_str());
            total += Split(videos[i], folder);
        }
        wchar_t done[160];
        swprintf(done, 160, L"Bitti. %d kare yazıldı.", total);
        MessageBoxW(NULL, done, L"Kare Ayır", MB_OK | MB_ICONINFORMATION);
    }
    Gdiplus::GdiplusShutdown(token);
    MFShutdown();
    CoUninitialize();
    Hold();
    return 0;
}
