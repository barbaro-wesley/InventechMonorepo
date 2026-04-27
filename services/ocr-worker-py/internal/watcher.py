import asyncio
import logging
import os
from typing import Awaitable, Callable

from watchdog.events import FileCreatedEvent, FileMovedEvent, FileSystemEventHandler
from watchdog.observers.polling import PollingObserver

logger = logging.getLogger(__name__)

FileCallback = Callable[[str], Awaitable[None]]

# Intervalo de polling em segundos — baixo o suficiente para reagir rápido,
# alto o suficiente para não desperdiçar CPU.
_POLL_INTERVAL = int(os.environ.get("WATCHER_POLL_INTERVAL", "3"))


class _EventHandler(FileSystemEventHandler):
    """Bridges watchdog's polling thread to the asyncio event loop."""

    def __init__(self, callback: FileCallback, loop: asyncio.AbstractEventLoop) -> None:
        super().__init__()
        self._callback = callback
        self._loop = loop

    def on_created(self, event: FileSystemEventHandler) -> None:
        if isinstance(event, FileCreatedEvent):
            asyncio.run_coroutine_threadsafe(
                self._callback(event.src_path), self._loop
            )

    def on_moved(self, event: FileSystemEventHandler) -> None:
        # SFTP renomeia o arquivo temporário para o nome final — isso é um MOVE, não CREATE
        if isinstance(event, FileMovedEvent):
            asyncio.run_coroutine_threadsafe(
                self._callback(event.dest_path), self._loop
            )


class DirectoryWatcher:
    """
    Watches a base directory recursively using polling.
    PollingObserver is used instead of InotifyObserver because inotify
    does not reliably propagate events inside Docker bind-mount volumes.
    """

    def __init__(self, base_dir: str, callback: FileCallback) -> None:
        self._base_dir = base_dir
        self._callback = callback
        self._observer: PollingObserver | None = None

    def start(self, loop: asyncio.AbstractEventLoop) -> None:
        handler = _EventHandler(self._callback, loop)
        self._observer = PollingObserver(timeout=_POLL_INTERVAL)
        self._observer.schedule(handler, self._base_dir, recursive=True)
        self._observer.start()
        logger.info("Watching (polling every %ds, recursive): %s", _POLL_INTERVAL, self._base_dir)

    def stop(self) -> None:
        if self._observer is not None:
            self._observer.stop()
            self._observer.join()
            logger.info("Watcher stopped")
