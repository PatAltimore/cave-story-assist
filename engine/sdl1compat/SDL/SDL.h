// Minimal SDL 1.2 API surface implemented on top of SDL2, for the
// Emscripten build (Emscripten's own SDL1 shim lacks colorkey blits and can't
// load the game's .pbm bitmaps). Only what NXEngine uses is provided.
// The engine includes <SDL/SDL.h>; this header shadows it via -Isdl1compat.
#ifndef SDL1COMPAT_H
#define SDL1COMPAT_H

#include <SDL2/SDL.h>

#ifdef __cplusplus
extern "C" {
#endif

#define SDL_HWSURFACE	0x00000001
#define SDL_HWPALETTE	0x20000000
#define SDL_FULLSCREEN	0x80000000
#define SDL_SRCCOLORKEY	0x00001000
#define SDL_SRCALPHA	0x00010000
#define SDL_APPMOUSEFOCUS	0x01
#define SDL_APPINPUTFOCUS	0x02
#define SDL_APPACTIVE		0x04

// SDL1 keysyms: SDL2 keycodes are identical for ASCII keys; the rest are remapped.
typedef int SDLKey;
#undef SDLK_UP
#undef SDLK_DOWN
#undef SDLK_LEFT
#undef SDLK_RIGHT
#undef SDLK_PAUSE
#undef SDLK_RSHIFT
#undef SDLK_LSHIFT
#undef SDLK_LCTRL
#undef SDLK_LALT
#define SDLK_UP		273
#define SDLK_DOWN	274
#define SDLK_RIGHT	275
#define SDLK_LEFT	276
#define SDLK_PAUSE	19
#define SDLK_RSHIFT	303
#define SDLK_LSHIFT	304
#define SDLK_LCTRL	306
#define SDLK_LALT	308
#undef SDLK_F1
#undef SDLK_F2
#undef SDLK_F3
#undef SDLK_F4
#undef SDLK_F5
#undef SDLK_F6
#undef SDLK_F7
#undef SDLK_F8
#undef SDLK_F9
#undef SDLK_F10
#undef SDLK_F11
#undef SDLK_F12
#define SDLK_F1		282
#define SDLK_F2		283
#define SDLK_F3		284
#define SDLK_F4		285
#define SDLK_F5		286
#define SDLK_F6		287
#define SDLK_F7		288
#define SDLK_F8		289
#define SDLK_F9		290
#define SDLK_F10	291
#define SDLK_F11	292
#define SDLK_F12	293
#define SDLK_LAST	323
// handheld buttons the extractor refers to; never generated on the web
#define SDLK_BTN1	320
#define SDLK_BTN2	321
#define SDLK_BTN3	322
#define SDLK_BTN4	323

typedef struct SDL_VideoInfo
{
	SDL_PixelFormat *vfmt;
} SDL_VideoInfo;

SDL_Surface *SDL1_SetVideoMode(int width, int height, int bpp, Uint32 flags);
int SDL1_Flip(SDL_Surface *screen);
int SDL1_SetColorKey(SDL_Surface *s, Uint32 flag, Uint32 key);
int SDL1_SetAlpha(SDL_Surface *s, Uint32 flag, Uint8 alpha);
SDL_Surface *SDL1_DisplayFormat(SDL_Surface *s);
int SDL1_SetColors(SDL_Surface *s, SDL_Color *colors, int first, int n);
const SDL_VideoInfo *SDL1_GetVideoInfo(void);
void SDL1_WM_SetCaption(const char *title, const char *icon);
void SDL1_WM_SetIcon(SDL_Surface *icon, Uint8 *mask);
void SDL1_WarpMouse(Uint16 x, Uint16 y);
Uint8 SDL1_GetAppState(void);
int SDL1_PollEvent(SDL_Event *ev);
const char *SDL1_GetKeyName(int sym);
int SDL1_OpenAudio(SDL_AudioSpec *desired, SDL_AudioSpec *obtained);

#define SDL_SetVideoMode	SDL1_SetVideoMode
#define SDL_Flip		SDL1_Flip
#define SDL_SetColorKey		SDL1_SetColorKey
#define SDL_SetAlpha		SDL1_SetAlpha
#define SDL_DisplayFormat	SDL1_DisplayFormat
#define SDL_SetColors		SDL1_SetColors
#define SDL_GetVideoInfo	SDL1_GetVideoInfo
#define SDL_WM_SetCaption	SDL1_WM_SetCaption
#define SDL_WM_SetIcon		SDL1_WM_SetIcon
#define SDL_WarpMouse		SDL1_WarpMouse
#define SDL_GetAppState		SDL1_GetAppState
#define SDL_PollEvent		SDL1_PollEvent
#define SDL_GetKeyName		SDL1_GetKeyName
#define SDL_OpenAudio		SDL1_OpenAudio
#define SDL_MixAudio(d, s, l, v)	SDL_MixAudioFormat(d, s, AUDIO_S16SYS, l, v)

#ifdef __cplusplus
}
#endif
#endif
