import asyncio
import logging
from typing import Awaitable, Callable

from watchdog.events import DirCreatedEvent, FileCreatedEvent, FileSystemEventHandler
from watchdog.observers import Observer

logger = logging.getLogger(__name__)

FileCallback = Callable[[str], Awaitable[None]]


class _EventHandler(FileSystemEventHandler):
    """Bridges watchdog's background thread to the asyncio event loop."""

    def __init__(self, callback: FileCallback, loop: asyncio.AbstractEventLoop) -> None:
        super().__init__()
        self._callback = callback
        self._loop = loop

    def on_created(self, event: FileSystemEventHandler) -> None:
        if isinstance(event, FileCreatedEvent):
            asyncio.run_coroutine_threadsafe(
                self._callback(event.src_path), self._loop
            )
        elif isinstance(event, DirCreatedEvent):
            logger.debug("New subdirectory detected (auto-watched): %s", event.src_path)


class DirectoryWatcher:
    """
    Watches a base directory recursively for new files.
    New subdirectories (one per printer SFTP slot) are automatically included
    because recursive=True is set on the observer.
    """

    def __init__(self, base_dir: str, callback: FileCallback) -> None:
        self._base_dir = base_dir
        self._callback = callback
        self._observer: Observer | None = None

    def start(self, loop: asyncio.AbstractEventLoop) -> None:
        handler = _EventHandler(self._callback, loop)
        self._observer = Observer()
        self._observer.schedule(handler, self._base_dir, recursive=True)
        self._observer.start()
        logger.info("Watching (recursive): %s", self._base_dir)

    def stop(self) -> None:
        if self._observer is not None:
            self._observer.stop()
            self._observer.join()
            logger.info("Watcher stopped")
