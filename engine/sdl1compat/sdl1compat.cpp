// SDL 1.2 -> SDL2 glue; see sdl1compat/SDL/SDL.h. Built without that header's
// macros so it can call the real SDL2 functions of the same names.
#include <SDL2/SDL.h>
#include <string.h>

static SDL_Window *window;
static SDL_Renderer *renderer;
static SDL_Texture *texture;
static SDL_Surface *screen;
static SDL_PixelFormat vinfo_fmt;

typedef struct { SDL_PixelFormat *vfmt; } VideoInfo;
static VideoInfo vinfo;

extern "C" SDL_Surface *SDL1_SetVideoMode(int w, int h, int bpp, Uint32 flags)
{
	if (texture) SDL_DestroyTexture(texture);
	if (screen) SDL_FreeSurface(screen);
	texture = NULL; screen = NULL;

	if (!window)
	{
		window = SDL_CreateWindow("NXEngine", SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED, w, h, 0);
		if (!window) return NULL;
		renderer = SDL_CreateRenderer(window, -1, 0);
		if (!renderer) return NULL;
		SDL_RenderSetLogicalSize(renderer, w, h);
	}
	else
	{
		SDL_SetWindowSize(window, w, h);
		SDL_RenderSetLogicalSize(renderer, w, h);
	}

	// always a 32-bit screen; the engine adapts to whatever bpp the video info reports
	screen = SDL_CreateRGBSurfaceWithFormat(0, w, h, 32, SDL_PIXELFORMAT_ARGB8888);
	texture = SDL_CreateTexture(renderer, SDL_PIXELFORMAT_ARGB8888, SDL_TEXTUREACCESS_STREAMING, w, h);
	return screen;
}

extern "C" int SDL1_Flip(SDL_Surface *s)
{
	if (!texture || s != screen) return 0;
	SDL_UpdateTexture(texture, NULL, screen->pixels, screen->pitch);
	SDL_RenderClear(renderer);
	SDL_RenderCopy(renderer, texture, NULL, NULL);
	SDL_RenderPresent(renderer);
	return 0;
}

// SDL2's colorkey handling differs from SDL1's in ways that bit us (conversion drops it,
// 8-bit keys aren't honoured on every blit path). For 32-bit surfaces, bake the key into
// the pixels instead: every pixel of the key color gets alpha 0, and the surface blends.
static void bake_colorkey(SDL_Surface *s, Uint32 key)
{
	Uint32 amask = s->format->Amask;
	if (s->format->BytesPerPixel != 4 || !amask) return;
	Uint32 rgbmask = ~amask;
	if (SDL_MUSTLOCK(s)) SDL_LockSurface(s);
	for (int y = 0; y < s->h; y++)
	{
		Uint32 *row = (Uint32 *)((Uint8 *)s->pixels + y * s->pitch);
		for (int x = 0; x < s->w; x++)
			if ((row[x] & rgbmask) == (key & rgbmask)) row[x] &= rgbmask;
			else row[x] |= amask;
	}
	if (SDL_MUSTLOCK(s)) SDL_UnlockSurface(s);
	SDL_SetColorKey(s, SDL_FALSE, 0);
	SDL_SetSurfaceBlendMode(s, SDL_BLENDMODE_BLEND);
}

extern "C" int SDL1_SetColorKey(SDL_Surface *s, Uint32 flag, Uint32 key)
{
	if ((flag & 0x1000) && s->format->BytesPerPixel == 4 && s->format->Amask)
	{
		bake_colorkey(s, key);
		return 0;
	}
	return SDL_SetColorKey(s, (flag & 0x1000) ? SDL_TRUE : SDL_FALSE, key);
}

extern "C" int SDL1_SetAlpha(SDL_Surface *s, Uint32 flag, Uint8 alpha)
{
	if (flag & 0x10000)
	{
		SDL_SetSurfaceAlphaMod(s, alpha);
		return SDL_SetSurfaceBlendMode(s, SDL_BLENDMODE_BLEND);
	}
	SDL_SetSurfaceAlphaMod(s, 255);
	return SDL_SetSurfaceBlendMode(s, SDL_BLENDMODE_NONE);
}

extern "C" SDL_Surface *SDL1_DisplayFormat(SDL_Surface *s)
{
	bool keyed = SDL_HasColorKey(s) == SDL_TRUE;
	Uint32 key = 0;
	Uint8 r = 0, g = 0, b = 0;
	if (keyed)
	{
		SDL_GetColorKey(s, &key);
		SDL_GetRGB(key, s->format, &r, &g, &b);
	}

	// convert without the source's colorkey (SDL2 would turn it into alpha inconsistently)
	SDL_Surface *conv = SDL_ConvertSurfaceFormat(s, SDL_PIXELFORMAT_ARGB8888, 0);
	if (conv && keyed)
	{
		SDL_SetColorKey(conv, SDL_FALSE, 0);
		bake_colorkey(conv, SDL_MapRGB(conv->format, r, g, b));
	}
	return conv;
}

extern "C" int SDL1_SetColors(SDL_Surface *s, SDL_Color *colors, int first, int n)
{
	if (!s->format->palette) return 0;
	return SDL_SetPaletteColors(s->format->palette, colors, first, n) == 0;
}

extern "C" const VideoInfo *SDL1_GetVideoInfo(void)
{
	// claim a 32-bit desktop so the engine picks a 32-bit screen
	vinfo_fmt = *SDL_AllocFormat(SDL_PIXELFORMAT_ARGB8888);
	vinfo.vfmt = &vinfo_fmt;
	return &vinfo;
}

extern "C" void SDL1_WM_SetCaption(const char *title, const char *icon)
{
	if (window) SDL_SetWindowTitle(window, title);
}

extern "C" void SDL1_WM_SetIcon(SDL_Surface *, Uint8 *) {}
extern "C" void SDL1_WarpMouse(Uint16, Uint16) {}
extern "C" Uint8 SDL1_GetAppState(void) { return 7; }

static int translate_key(const SDL_Keysym &k)
{
	switch (k.scancode)
	{
		case SDL_SCANCODE_UP: return 273;
		case SDL_SCANCODE_DOWN: return 274;
		case SDL_SCANCODE_RIGHT: return 275;
		case SDL_SCANCODE_LEFT: return 276;
		case SDL_SCANCODE_PAUSE: return 19;
		case SDL_SCANCODE_RSHIFT: return 303;
		case SDL_SCANCODE_LSHIFT: return 304;
		case SDL_SCANCODE_LCTRL: return 306;
		case SDL_SCANCODE_LALT: return 308;
		default: break;
	}
	if (k.scancode >= SDL_SCANCODE_F1 && k.scancode <= SDL_SCANCODE_F12)
		return 282 + (k.scancode - SDL_SCANCODE_F1);
	if (k.sym & SDLK_SCANCODE_MASK) return 0;
	return k.sym;
}

extern "C" int SDL1_PollEvent(SDL_Event *ev)
{
	while (SDL_PollEvent(ev))
	{
		if (ev->type == SDL_KEYDOWN || ev->type == SDL_KEYUP)
		{
			if (ev->key.repeat) continue;
			int sym = translate_key(ev->key.keysym);
			if (!sym) continue;
			ev->key.keysym.sym = sym;
			return 1;
		}
		if (ev->type == SDL_QUIT) return 1;
	}
	return 0;
}

extern "C" const char *SDL1_GetKeyName(int sym)
{
	switch (sym)
	{
		case 273: return "up";
		case 274: return "down";
		case 275: return "right";
		case 276: return "left";
		case 303: return "right shift";
		case 304: return "left shift";
		case 306: return "left ctrl";
		case 308: return "left alt";
		case 19: return "pause";
	}
	if (sym >= 282 && sym <= 293)
	{
		static char buf[8];
		SDL_snprintf(buf, sizeof(buf), "f%d", sym - 281);
		return buf;
	}
	return SDL_GetKeyName(sym);
}

// SDL1 semantics: if "obtained" is given the device may differ; SDL2's
// conversion path (obtained == NULL) lets the engine keep its exact format.
extern "C" int SDL1_OpenAudio(SDL_AudioSpec *desired, SDL_AudioSpec *obtained)
{
	int r = SDL_OpenAudio(desired, NULL);
	if (r == 0 && obtained)
	{
		*obtained = *desired;
		obtained->size = desired->samples * desired->channels * 2;
	}
	return r;
}
