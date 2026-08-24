"""
As rotas que `frontend/src/data/apiRepo.ts` chama, na ordem em que ele as usa.

As rotas de ação (`restore/`, `reorder/`) vêm antes das de detalhe: sem isso
`/api/shows/restore/` seria lido como a peça de id "restore".
"""

from django.urls import path

from . import views

urlpatterns = [
    path("deck/", views.deck, name="deck"),

    path("shows/", views.shows, name="shows"),
    path("shows/restore/", views.shows_restore, name="shows-restore"),
    path("shows/reorder/", views.shows_reorder, name="shows-reorder"),
    path("shows/<str:show_id>/", views.show_detail, name="show-detail"),
    path("shows/<str:show_id>/duplicate/", views.show_duplicate, name="show-duplicate"),

    path("days/", views.days, name="days"),
    path("days/restore/", views.days_restore, name="days-restore"),
    path("days/reorder/", views.days_reorder, name="days-reorder"),
    path("days/<str:day_id>/", views.day_detail, name="day-detail"),
    path("days/<str:day_id>/duplicate/", views.day_duplicate, name="day-duplicate"),

    path("scenes/", views.scenes, name="scenes"),
    path("scenes/restore/", views.scenes_restore, name="scenes-restore"),
    path("scenes/reorder/", views.scenes_reorder, name="scenes-reorder"),
    path("scenes/<str:scene_id>/", views.scene_detail, name="scene-detail"),
    path("scenes/<str:scene_id>/move/", views.scene_move, name="scene-move"),
    path("scenes/<str:scene_id>/copy/", views.scene_copy, name="scene-copy"),

    path("cues/", views.cues, name="cues"),
    path("cues/restore/", views.cues_restore, name="cues-restore"),
    path("cues/reorder/", views.cues_reorder, name="cues-reorder"),
    path("cues/<str:cue_id>/", views.cue_detail, name="cue-detail"),

    path("audios/", views.audios, name="audios"),
    path("audios/restore/", views.audios_restore, name="audios-restore"),
    path("audios/<str:audio_id>/", views.audio_detail, name="audio-detail"),

    # O espetáculo inteiro como arquivo: sai por GET, entra por POST.
    path("pacote/", views.pacote_view, name="pacote"),
]
