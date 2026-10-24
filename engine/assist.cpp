// Entry points the web page (web/index.html) calls to drive and inspect the game.
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#include <unistd.h>
#include "nx.h"

#ifndef ASSIST_BUILD
#define ASSIST_BUILD 0
#endif

extern bool assist_hide_text;

// Called once per game tick from gameloop(), right after the tick has been drawn. At that
// point nothing is suspended in an ASYNCIFY sleep, so every bit of game state lives in
// linear memory and the page can copy it out (rewind snapshots, save states) or copy an
// older image back in (restore) without leaving the engine in an inconsistent state.
EM_JS(void, js_frame_hook, (), {
	if (Module.assistFrame) Module.assistFrame();
});

void assist_frame_hook(void) { js_frame_hook(); }

extern "C" {

EMSCRIPTEN_KEEPALIVE void assist_set_hide_text(int hide) { assist_hide_text = (hide != 0); }

EMSCRIPTEN_KEEPALIVE int assist_tb_visible(void) { return textbox.IsVisible(); }

// which: 0 x, 1 y, 2 w, 3 h, 4 text x, 5 has face   (game pixels, 320x240 screen)
EMSCRIPTEN_KEEPALIVE int assist_tb_layout(int which)
{
	int v[6];
	textbox.GetLayout(&v[0], &v[1], &v[2], &v[3], &v[4], &v[5]);
	return v[which];
}

// 1 while the "stage name" banner that fades in on entering a map is showing
EMSCRIPTEN_KEEPALIVE int assist_mapname_visible(void) { return game.showmapnametime > 0; }

EMSCRIPTEN_KEEPALIVE int assist_hp(void) { return player ? player->hp : 0; }
EMSCRIPTEN_KEEPALIVE int assist_max_hp(void) { return player ? player->maxHealth : 0; }
EMSCRIPTEN_KEEPALIVE const char *assist_stage(void) { return stages[game.curmap].filename; }
EMSCRIPTEN_KEEPALIVE const char *assist_stage_title(void) { return stages[game.curmap].stagename; }

EMSCRIPTEN_KEEPALIVE int assist_player_x(void) { return player ? (player->x >> CSF) : 0; }
EMSCRIPTEN_KEEPALIVE int assist_player_y(void) { return player ? (player->y >> CSF) : 0; }

EMSCRIPTEN_KEEPALIVE void assist_set_god(int on) { game.debug.god = (on != 0); }
EMSCRIPTEN_KEEPALIVE int assist_get_god(void) { return game.debug.god; }
EMSCRIPTEN_KEEPALIVE void assist_heal(void) { if (player) player->hp = player->maxHealth; }

// ---- snapshot support -----------------------------------------------------------

// end of the used part of linear memory (static data, stack and heap all sit below it)
EMSCRIPTEN_KEEPALIVE unsigned assist_heap_top(void) { return (unsigned)sbrk(0); }

// the 32-bit screen surface: rebuilt from scratch every tick, so snapshots skip it
// (and use it for rewind thumbnails)
EMSCRIPTEN_KEEPALIVE unsigned assist_screen_pixels(void)
{
	return screen ? (unsigned)screen->GetSDLSurface()->pixels : 0;
}
EMSCRIPTEN_KEEPALIVE unsigned assist_screen_bytes(void)
{
	if (!screen) return 0;
	SDL_Surface *s = screen->GetSDLSurface();
	return s->pitch * s->h;
}
EMSCRIPTEN_KEEPALIVE int assist_screen_width(void) { return screen ? screen->GetSDLSurface()->w : 0; }
EMSCRIPTEN_KEEPALIVE int assist_screen_height(void) { return screen ? screen->GetSDLSurface()->h : 0; }

// a state saved by one build can't be loaded by another (memory layout differs)
EMSCRIPTEN_KEEPALIVE int assist_build_id(void) { return ASSIST_BUILD; }

}
#endif
