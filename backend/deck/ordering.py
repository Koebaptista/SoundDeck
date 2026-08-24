"""
Ordem é posição na lista, sempre densa.

Cada nível é reindexado dentro do pai: dias dentro da peça, cenas dentro do
dia, cues dentro da cena. Sem isso, remover a terceira cena deixaria o roteiro
numerado 1, 2, 4 — e mover uma cena de dia deixaria dois blocos com o mesmo
número na tela do operador.

É a mesma regra do mock do frontend (`reindex`/`densify` em `mockRepo.ts`),
para que o deck não mude de comportamento ao trocar de repositório.
"""

from __future__ import annotations

from django.db import models

#: Qualquer um dos dois: `Scene.objects` ou `day.scenes`. As rotas usam os dois
#: jeitos, e normalizar aqui evita repetir `.all()` em toda chamada.
Group = models.QuerySet | models.Manager


def densify(group: Group) -> None:
    """Renumera 0..n-1 na ordem atual, gravando só o que de fato mudou."""
    changed = []
    for index, item in enumerate(group.all().order_by("order", "id")):
        if item.order != index:
            item.order = index
            changed.append(item)
    if changed:
        type(changed[0]).objects.bulk_update(changed, ["order"])


def next_order(group: Group) -> int:
    """Posição de quem entra no fim da lista."""
    return group.all().count()


def open_slot(group: Group, order: int) -> None:
    """
    Empurra para baixo quem está em `order` ou depois.

    É o que faz o desfazer devolver a cena para o lugar de onde ela saiu, em
    vez de jogá-la no fim do roteiro.
    """
    group.all().filter(order__gte=order).update(order=models.F("order") + 1)


def apply_order(group: Group, ids: list[str]) -> None:
    """
    Aplica a ordem que veio da tela, ignorando id que não pertence ao grupo.

    Quem não foi citado vai para o fim, preservando a ordem relativa: uma tela
    desatualizada reordena o que conhece sem embaralhar o resto.
    """
    items = {item.pk: item for item in group.all()}
    ordered = [items.pop(item_id) for item_id in ids if item_id in items]
    ordered.extend(sorted(items.values(), key=lambda item: (item.order, item.pk)))
    changed = []
    for index, item in enumerate(ordered):
        if item.order != index:
            item.order = index
            changed.append(item)
    if changed:
        type(changed[0]).objects.bulk_update(changed, ["order"])
