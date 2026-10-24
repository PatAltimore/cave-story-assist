// Entry points the web page (web/index.html) calls to drive and inspect the game.
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#include "nx.h"

extern bool assist_hide_text;

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

EMSCRIPTEN_KEEPALIVE int assist_hp(void) { return player ? player->hp : 0; }
EMSCRIPTEN_KEEPALIVE int assist_max_hp(void) { return player ? player->maxHealth : 0; }
EMSCRIPTEN_KEEPALIVE const char *assist_stage(void) { return stages[game.curmap].filename; }
EMSCRIPTEN_KEEPALIVE const char *assist_stage_title(void) { return stages[game.curmap].stagename; }

EMSCRIPTEN_KEEPALIVE void assist_set_god(int on) { game.debug.god = (on != 0); }
EMSCRIPTEN_KEEPALIVE int assist_get_god(void) { return game.debug.god; }
EMSCRIPTEN_KEEPALIVE void assist_heal(void) { if (player) player->hp = player->maxHealth; }

}
#endif
