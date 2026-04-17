import argparse
import asyncio
import math
import random
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List

import aiohttp


DEVICE_TYPES = ["thermostat", "camera", "freezer", "meter", "pump"]
REGIONS = ["us-east", "us-west", "eu-central", "ap-south"]
@dataclass
class DeviceState:
    device_id: str
    device_type: str
    region: str
    phase: float
    battery_pct: float


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_devices(count: int) -> List[DeviceState]:
    devices: List[DeviceState] = []
    for index in range(count):
        devices.append(
            DeviceState(
                device_id=f"dev-{index + 1:04d}",
                device_type=random.choice(DEVICE_TYPES),
                region=random.choice(REGIONS),
                phase=random.uniform(0.0, math.pi * 2),
                battery_pct=random.uniform(45.0, 100.0),
            )
        )
    return devices


def make_event(device: DeviceState, tick: int) -> dict:
    wave = math.sin(device.phase + tick / 12)
    humidity_wave = math.cos(device.phase + tick / 18)

    device.battery_pct = max(5.0, device.battery_pct - random.uniform(0.005, 0.04))

    temperature = 58 + wave * 18 + random.uniform(-2.2, 2.2)
    humidity = 42 + humidity_wave * 16 + random.uniform(-3.0, 3.0)
    signal = max(8.0, min(100.0, 72 + wave * 20 + random.uniform(-8.0, 8.0)))

    status = "online"
    if temperature > 75 or device.battery_pct < 24 or signal < 24:
        status = "warning"
    if random.random() < 0.008:
        status = "offline"

    return {
        "eventId": f"evt-{device.device_id}-{tick}-{time.time_ns()}",
        "deviceId": device.device_id,
        "deviceType": device.device_type,
        "status": status,
        "temperatureC": round(temperature, 2),
        "humidityPct": round(max(10.0, min(95.0, humidity)), 2),
        "batteryPct": round(device.battery_pct, 2),
        "signalStrength": round(signal, 2),
        "region": device.region,
        "createdAt": iso_now(),
    }


async def post_batch(session: aiohttp.ClientSession, endpoint: str, batch: List[dict]) -> None:
    async with session.post(endpoint, json={"events": batch}) as response:
        if response.status >= 400:
            body = await response.text()
            raise RuntimeError(f"Ingestion failed with {response.status}: {body}")


async def run_simulator(base_url: str, device_count: int, rate: int, batch_size: int) -> None:
    endpoint = f"{base_url.rstrip('/')}/api/events/bulk"
    devices = build_devices(device_count)
    tick = 0
    print(f"Streaming to {endpoint} with {device_count} devices at ~{rate} events/sec")

    timeout = aiohttp.ClientTimeout(total=30)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        while True:
            started = time.perf_counter()
            batch = []
            events_this_cycle = max(rate, batch_size)

            for _ in range(events_this_cycle):
                tick += 1
                device = random.choice(devices)
                batch.append(make_event(device, tick))

                if len(batch) >= batch_size:
                    await post_batch(session, endpoint, batch)
                    batch = []

            if batch:
                await post_batch(session, endpoint, batch)

            elapsed = time.perf_counter() - started
            sleep_for = max(0.0, 1.0 - elapsed)
            await asyncio.sleep(sleep_for)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Real-time IoT event simulator")
    parser.add_argument("--base-url", default="http://localhost:4000", help="Backend base URL")
    parser.add_argument("--devices", type=int, default=250, help="Number of simulated devices")
    parser.add_argument("--rate", type=int, default=200, help="Approximate events per second")
    parser.add_argument("--batch-size", type=int, default=50, help="Events per request batch")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    try:
        asyncio.run(run_simulator(args.base_url, args.devices, args.rate, args.batch_size))
    except KeyboardInterrupt:
        print("Simulator stopped")
