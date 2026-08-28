from app.schemas.odds import OddsTick


def encode_tick(tick: OddsTick) -> bytes:
    """Serialize once to compact UTF-8 JSON bytes.

    Returning bytes lets the WebSocket relay broadcast the same immutable buffer
    to every connection instead of re-serializing per client. Pydantic v2 uses
    pydantic-core's Rust JSON encoder, keeping serialization overhead very low.
    """

    return tick.model_dump_json().encode("utf-8")
