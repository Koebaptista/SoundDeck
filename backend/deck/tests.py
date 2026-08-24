"""
Testes do contrato — não do Django.

Cada um afirma algo que a interface depende que seja verdade: que o deck sai
inteiro numa resposta só, que remover devolve o que levou junto, que restaurar
recompõe a árvore com os ids originais e no lugar de onde ela saiu, e que a
ordem continua densa depois de cada escrita. São exatamente as promessas que
`frontend/src/data/repo.ts` faz aos componentes.
"""

from __future__ import annotations

import shutil
import tempfile
import wave
from pathlib import Path

from django.test import TestCase, override_settings

from .models import Audio, Cue, Day, Scene, Show

MEDIA = Path(tempfile.mkdtemp(prefix="sounddeck-test-"))


def wav_bytes(seconds: float = 0.25) -> bytes:
    """Um WAV mínimo de verdade — o upload lê a duração do arquivo."""
    path = MEDIA / "fonte.wav"
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(8000)
        handle.writeframes(b"\x00\x00" * int(8000 * seconds))
    return path.read_bytes()


@override_settings(MEDIA_ROOT=MEDIA)
class ApiTests(TestCase):
    maxDiff = None

    @classmethod
    def tearDownClass(cls) -> None:
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self) -> None:
        self.audio = Audio.objects.create(
            id="a-teste",
            name="Trovão",
            description="",
            file="audio/trovao.wav",
            duration=5.2,
            format="WAV",
            size=1024,
        )

    # -------------------------------------------------------- utilidades

    def post(self, path: str, body: dict | None = None):
        return self.client.post(path, body or {}, content_type="application/json")

    def patch(self, path: str, body: dict):
        return self.client.patch(path, body, content_type="application/json")

    def make_show(self, name: str = "O Jardim de Inverno") -> dict:
        return self.post("/api/shows/", {"name": name, "venue": "Teatro Municipal"}).json()

    def make_scene(self, day_id: str, name: str = "Abertura") -> dict:
        return self.post("/api/scenes/", {"day": day_id, "name": name}).json()

    def make_cue(self, scene_id: str, deixa: str = "Na deixa") -> dict:
        return self.post(
            "/api/cues/",
            {
                "sceneId": scene_id,
                "audioId": self.audio.pk,
                "cue": deixa,
                "key": "1",
                "volume": 0.8,
                "loop": False,
            },
        ).json()

    def first_day(self, show_id: str) -> str:
        return Day.objects.get(show_id=show_id, order=0).pk

    def orders(self, model, **filters) -> list[int]:
        return list(model.objects.filter(**filters).values_list("order", flat=True))

    # ------------------------------------------------------------- deck

    def test_deck_sai_inteiro_em_uma_resposta(self):
        show = self.make_show()
        scene = self.make_scene(self.first_day(show["id"]))
        self.make_cue(scene["id"])

        body = self.client.get("/api/deck/").json()

        self.assertEqual(set(body), {"shows", "days", "scenes", "audios", "cues"})
        self.assertEqual(body["shows"][0]["venue"], "Teatro Municipal")
        self.assertEqual(body["days"][0]["showId"], show["id"])
        self.assertEqual(body["scenes"][0]["dayId"], self.first_day(show["id"]))
        self.assertEqual(body["cues"][0]["sceneId"], scene["id"])
        self.assertEqual(body["cues"][0]["audioId"], self.audio.pk)
        self.assertEqual(body["audios"][0]["src"], "/media/audio/trovao.wav")

    def test_peca_nasce_com_o_primeiro_dia(self):
        # Uma peça sem dia nenhum não teria onde guardar cena.
        show = self.make_show()
        self.assertEqual(Day.objects.filter(show_id=show["id"]).count(), 1)

    def test_item_que_sumiu_responde_404_com_frase(self):
        response = self.client.delete("/api/scenes/s-inexistente/")
        self.assertEqual(response.status_code, 404)
        self.assertIn("não existe mais", response.json()["detail"])

    # -------------------------------------------------------- remoção

    def test_remover_peca_devolve_a_arvore_inteira(self):
        show = self.make_show()
        day = self.first_day(show["id"])
        scene = self.make_scene(day)
        cue = self.make_cue(scene["id"])

        bundle = self.client.delete(f"/api/shows/{show['id']}/").json()

        self.assertEqual(bundle["show"]["id"], show["id"])
        self.assertEqual([d["id"] for d in bundle["days"]], [day])
        self.assertEqual([s["id"] for s in bundle["scenes"]], [scene["id"]])
        self.assertEqual([c["id"] for c in bundle["cues"]], [cue["id"]])
        self.assertEqual(Cue.objects.count(), 0)

    def test_desfazer_recompoe_a_peca_no_lugar_de_onde_saiu(self):
        primeira = self.make_show("Primeira")
        alvo = self.make_show("Alvo")
        self.make_show("Terceira")
        scene = self.make_scene(self.first_day(alvo["id"]), "Confronto")
        self.make_cue(scene["id"], "Na deixa “nunca mais”")

        bundle = self.client.delete(f"/api/shows/{alvo['id']}/").json()
        self.assertEqual(self.post("/api/shows/restore/", bundle).status_code, 204)

        restaurada = Show.objects.get(pk=alvo["id"])
        self.assertEqual(restaurada.order, 1)
        self.assertEqual([s.name for s in Show.objects.all()], ["Primeira", "Alvo", "Terceira"])
        self.assertEqual(Scene.objects.get(pk=scene["id"]).name, "Confronto")
        self.assertEqual(Cue.objects.get(scene_id=scene["id"]).cue, "Na deixa “nunca mais”")
        self.assertEqual(Show.objects.get(pk=primeira["id"]).order, 0)

    def test_desfazer_cena_devolve_os_cues_na_posicao(self):
        show = self.make_show()
        day = self.first_day(show["id"])
        self.make_scene(day, "Abertura")
        alvo = self.make_scene(day, "Entrada de Ana")
        self.make_scene(day, "Final")
        self.make_cue(alvo["id"])

        bundle = self.client.delete(f"/api/scenes/{alvo['id']}/").json()
        self.assertEqual(self.orders(Scene, day_id=day), [0, 1])

        self.post("/api/scenes/restore/", bundle)

        self.assertEqual(Scene.objects.get(pk=alvo["id"]).order, 1)
        self.assertEqual(
            [s.name for s in Scene.objects.filter(day_id=day)],
            ["Abertura", "Entrada de Ana", "Final"],
        )
        self.assertEqual(Cue.objects.filter(scene_id=alvo["id"]).count(), 1)

    def test_remover_cue_do_meio_fecha_o_buraco_na_ordem(self):
        show = self.make_show()
        scene = self.make_scene(self.first_day(show["id"]))
        self.make_cue(scene["id"], "primeiro")
        meio = self.make_cue(scene["id"], "segundo")
        self.make_cue(scene["id"], "terceiro")

        removido = self.client.delete(f"/api/cues/{meio['id']}/").json()

        self.assertEqual(removido["cue"], "segundo")
        self.assertEqual(self.orders(Cue, scene_id=scene["id"]), [0, 1])

        self.post("/api/cues/restore/", {"cues": [removido]})

        self.assertEqual(
            [c.cue for c in Cue.objects.filter(scene_id=scene["id"])],
            ["primeiro", "segundo", "terceiro"],
        )

    # --------------------------------------------------------- ordem

    def test_reordenar_cenas_grava_a_ordem_da_tela(self):
        show = self.make_show()
        day = self.first_day(show["id"])
        a = self.make_scene(day, "A")
        b = self.make_scene(day, "B")
        c = self.make_scene(day, "C")

        response = self.post(
            "/api/scenes/reorder/", {"day": day, "ids": [c["id"], a["id"], b["id"]]}
        )

        self.assertEqual(response.status_code, 204)
        self.assertEqual([s.name for s in Scene.objects.filter(day_id=day)], ["C", "A", "B"])

    def test_reordenar_ignora_id_de_outro_dia(self):
        show = self.make_show()
        day = self.first_day(show["id"])
        outro = self.post("/api/days/", {"show": show["id"], "name": "Sábado", "date": None}).json()
        a = self.make_scene(day, "A")
        intruso = self.make_scene(outro["id"], "Intrusa")

        self.post("/api/scenes/reorder/", {"day": day, "ids": [intruso["id"], a["id"]]})

        self.assertEqual(Scene.objects.get(pk=a["id"]).order, 0)
        self.assertEqual(Scene.objects.get(pk=intruso["id"]).day_id, outro["id"])

    # ------------------------------------------------------- cópias

    def test_duplicar_dia_copia_o_roteiro_com_ids_novos(self):
        show = self.make_show()
        origem = self.first_day(show["id"])
        scene = self.make_scene(origem, "Confronto")
        self.make_cue(scene["id"], "Na deixa")

        copia = self.post(
            f"/api/days/{origem}/duplicate/", {"name": "Sábado, 20h", "date": "2026-09-04"}
        ).json()

        nova = Scene.objects.get(day_id=copia["id"])
        self.assertNotEqual(nova.pk, scene["id"])
        self.assertEqual(nova.name, "Confronto")
        self.assertEqual(nova.cues.first().cue, "Na deixa")
        self.assertNotEqual(nova.cues.first().pk, Cue.objects.get(scene_id=scene["id"]).pk)
        self.assertEqual(copia["date"], "2026-09-04")

    def test_duplicar_peca_leva_todos_os_dias(self):
        show = self.make_show()
        self.post("/api/days/", {"show": show["id"], "name": "Sábado", "date": None})
        scene = self.make_scene(self.first_day(show["id"]))
        self.make_cue(scene["id"])

        copia = self.post(
            f"/api/shows/{show['id']}/duplicate/",
            {"name": "O Jardim de Inverno", "venue": "Teatro do Sesc"},
        ).json()

        self.assertEqual(Day.objects.filter(show_id=copia["id"]).count(), 2)
        self.assertEqual(Scene.objects.filter(day__show_id=copia["id"]).count(), 1)
        self.assertEqual(Cue.objects.filter(scene__day__show_id=copia["id"]).count(), 1)
        self.assertEqual(copia["venue"], "Teatro do Sesc")

    def test_mover_cena_entra_no_fim_do_dia_de_destino(self):
        show = self.make_show()
        origem = self.first_day(show["id"])
        destino = self.post(
            "/api/days/", {"show": show["id"], "name": "Sábado", "date": None}
        ).json()["id"]
        self.make_scene(destino, "Já estava aqui")
        self.make_scene(origem, "Primeira")
        viajante = self.make_scene(origem, "Viajante")

        response = self.post(f"/api/scenes/{viajante['id']}/move/", {"day": destino})

        self.assertEqual(response.status_code, 204)
        movida = Scene.objects.get(pk=viajante["id"])
        self.assertEqual(movida.day_id, destino)
        self.assertEqual(movida.order, 1)
        self.assertEqual(self.orders(Scene, day_id=origem), [0])

    def test_copiar_cena_deixa_a_original_no_lugar(self):
        show = self.make_show()
        origem = self.first_day(show["id"])
        destino = self.post(
            "/api/days/", {"show": show["id"], "name": "Sábado", "date": None}
        ).json()["id"]
        scene = self.make_scene(origem, "Abertura")
        self.make_cue(scene["id"])

        copia = self.post(f"/api/scenes/{scene['id']}/copy/", {"day": destino}).json()

        self.assertEqual(copia["dayId"], destino)
        self.assertEqual(Scene.objects.get(pk=scene["id"]).day_id, origem)
        self.assertEqual(Cue.objects.filter(scene_id=copia["id"]).count(), 1)

    # ---------------------------------------------------- biblioteca

    def test_upload_le_duracao_e_formato_do_arquivo(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        upload = SimpleUploadedFile("Trovão distante.wav", wav_bytes(0.5), "audio/wav")
        body = self.client.post(
            "/api/audios/", {"file": upload, "name": "Trovão distante"}
        ).json()

        self.assertEqual(body["name"], "Trovão distante")
        self.assertEqual(body["format"], "WAV")
        self.assertAlmostEqual(body["duration"], 0.5, places=2)
        self.assertTrue(body["src"].startswith("/media/audio/"))

    def test_upload_mede_wav_de_cabecalho_zerado(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        # Cabeçalho com o tamanho do bloco `data` zerado, como o que sai do
        # `gen-audio.mjs`: o navegador toca, o `mutagen` devolve 0:00.
        bruto = bytearray(wav_bytes(1.0))
        bruto[40:44] = b"\x00\x00\x00\x00"
        upload = SimpleUploadedFile("mentiroso.wav", bytes(bruto), "audio/wav")

        body = self.client.post("/api/audios/", {"file": upload, "name": "Vento"}).json()

        self.assertAlmostEqual(body["duration"], 1.0, places=2)

    def test_remover_audio_leva_os_cues_e_o_desfazer_traz_os_dois(self):
        show = self.make_show()
        scene = self.make_scene(self.first_day(show["id"]))
        cue = self.make_cue(scene["id"], "Na deixa “nunca mais”")

        bundle = self.client.delete(f"/api/audios/{self.audio.pk}/").json()

        self.assertEqual(bundle["audio"]["id"], self.audio.pk)
        self.assertEqual([c["id"] for c in bundle["cues"]], [cue["id"]])
        self.assertEqual(Cue.objects.count(), 0)
        # Some do deck, mas continua no servidor enquanto o aviso está na tela.
        self.assertEqual(self.client.get("/api/deck/").json()["audios"], [])
        self.assertIsNotNone(Audio.objects.get(pk=self.audio.pk).deleted_at)

        self.post("/api/audios/restore/", {"audio": self.audio.pk, "cues": bundle["cues"]})

        self.assertEqual(len(self.client.get("/api/deck/").json()["audios"]), 1)
        self.assertEqual(Cue.objects.get(pk=cue["id"]).cue, "Na deixa “nunca mais”")

    def test_cue_orfao_nao_derruba_o_desfazer(self):
        show = self.make_show()
        scene = self.make_scene(self.first_day(show["id"]))
        cue = self.make_cue(scene["id"])
        bundle = self.client.delete(f"/api/scenes/{scene['id']}/").json()

        # A cena de destino sumiu de vez enquanto o aviso estava na tela.
        bundle["scene"]["dayId"] = self.first_day(show["id"])
        bundle["cues"].append({**cue, "id": "c-fantasma", "sceneId": "s-que-nao-existe"})

        self.assertEqual(self.post("/api/scenes/restore/", bundle).status_code, 204)
        self.assertEqual(Cue.objects.filter(pk="c-fantasma").count(), 0)
        self.assertEqual(Cue.objects.filter(scene_id=scene["id"]).count(), 1)

    # ---------------------------------------------------- arquivos

    def test_media_entrega_o_trecho_pedido(self):
        # O engine toca por streaming tudo que passa de 45s, e elemento de
        # áudio sem `Accept-Ranges` não consegue buscar posição na faixa.
        conteudo = wav_bytes(1.0)
        (MEDIA / "audio").mkdir(parents=True, exist_ok=True)
        (MEDIA / "audio" / "longa.wav").write_bytes(conteudo)

        inteiro = self.client.get("/media/audio/longa.wav")
        self.assertEqual(inteiro.headers["Accept-Ranges"], "bytes")

        trecho = self.client.get("/media/audio/longa.wav", headers={"Range": "bytes=100-199"})
        self.assertEqual(trecho.status_code, 206)
        self.assertEqual(trecho.headers["Content-Length"], "100")
        self.assertEqual(
            trecho.headers["Content-Range"], f"bytes 100-199/{len(conteudo)}"
        )
        self.assertEqual(b"".join(trecho.streaming_content), conteudo[100:200])

    def test_media_entende_as_formas_abertas_do_range(self):
        conteudo = wav_bytes(0.5)
        (MEDIA / "audio").mkdir(parents=True, exist_ok=True)
        (MEDIA / "audio" / "aberta.wav").write_bytes(conteudo)
        total = len(conteudo)

        fim = self.client.get("/media/audio/aberta.wav", headers={"Range": "bytes=-64"})
        self.assertEqual(b"".join(fim.streaming_content), conteudo[-64:])

        resto = self.client.get(
            "/media/audio/aberta.wav", headers={"Range": f"bytes={total - 10}-"}
        )
        self.assertEqual(b"".join(resto.streaming_content), conteudo[-10:])

        fora = self.client.get(
            "/media/audio/aberta.wav", headers={"Range": f"bytes={total + 5}-"}
        )
        self.assertEqual(fora.status_code, 416)
        self.assertEqual(fora.headers["Content-Range"], f"bytes */{total}")

    def test_patch_de_cue_aceita_um_campo_de_cada_vez(self):
        show = self.make_show()
        scene = self.make_scene(self.first_day(show["id"]))
        cue = self.make_cue(scene["id"])

        self.patch(f"/api/cues/{cue['id']}/", {"volume": 0.35})
        self.patch(f"/api/cues/{cue['id']}/", {"loop": True})
        self.patch(f"/api/cues/{cue['id']}/", {"key": None})

        gravado = Cue.objects.get(pk=cue["id"])
        self.assertAlmostEqual(gravado.volume, 0.35)
        self.assertTrue(gravado.loop)
        self.assertIsNone(gravado.key)

    def test_volume_fora_da_faixa_e_recusado(self):
        show = self.make_show()
        scene = self.make_scene(self.first_day(show["id"]))
        cue = self.make_cue(scene["id"])

        response = self.patch(f"/api/cues/{cue['id']}/", {"volume": 4})

        self.assertEqual(response.status_code, 400)
        self.assertIn("detail", response.json())
