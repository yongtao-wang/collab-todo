# core/pubsub_listener.py
import json
import threading

from core.coordinator import Coordinator
from flask_socketio import SocketIO
from redis import Redis
from utils.constants import SocketEvents as se
from utils.logger import get_logger

logger = get_logger(__name__)


class PubSubListener:

    def __init__(
        self,
        redis_client: Redis,
        coordinator: Coordinator,
        socketio: SocketIO,
    ):
        self.redis = redis_client
        self.coordinator = coordinator
        self.socket = socketio

        self.pubsub = None
        self.listener_thread = None
        self._running = False

    def start(self):
        """Start listening to Redis Pub/Sub channel"""
        if self._running:
            logger.warning('Pub/Sub listener already running')
            return

        self.pubsub = self.redis.pubsub()
        self.pubsub.subscribe('todo:updates')

        self._running = True
        self.listener_thread = threading.Thread(
            target=self._listen, daemon=True, name='PubSubListener'
        )
        self.listener_thread.start()

        logger.info('Pub/Sub listener started')

    def _listen(self):
        """Listen for Pub/Sub messages in background thread"""
        logger.info('Pub/Sub listener thread running')

        try:
            for message in self.pubsub.listen():
                if not self._running:
                    break

                if message['type'] == 'message':
                    try:
                        self._handle_message(message)
                    except Exception as e:
                        logger.error(
                            'Error handling Pub/Sub message: %s', e, exc_info=True
                        )

        except Exception as e:
            logger.error('Pub/Sub listener thread error: %s', e, exc_info=True)

        finally:
            logger.info('Pub/Sub listener thread stopped')

    def _handle_message(self, message):
        """Handle incoming Pub/Sub message from Redis"""

        message_data = message['data']
        if isinstance(message_data, bytes):
            message_data = message_data.decode('utf-8')
        data = json.loads(message['data'])
        event_type = data['type']
        list_id = data['list_id']

        logger.debug('Received Pub/Sub event: %s for list %s', event_type, list_id)

        # Update L1 cache if list is loaded on this server
        state_manager = self.coordinator.state_manager

        if state_manager.has_list(list_id):
            if event_type == se.ITEM_ADDED:
                item = data['item']
                state_manager.add_item_state(list_id, item['id'], item)
                state_manager.set_revision(list_id, data['rev'])

            elif event_type == se.ITEM_UPDATED:
                item = data['item']
                state_manager.update_item_state(list_id, item['id'], item)
                state_manager.set_revision(list_id, data['rev'])

            elif event_type == se.ITEM_DELETED:
                state_manager.delete_item_state(list_id, data['item_id'])
                state_manager.set_revision(list_id, data['rev'])

            # TODO: Update list name event
            # TODO: Delete list event

        # Broadcast to room == list_id
        self.socket.emit(event_type, data, to=list_id)
        logger.debug('Broadcasted %s event to room %s', event_type, list_id)

    def stop(self):
        """Stop listening and clean up"""
        logger.info('Stopping Pub/Sub listener...')

        self._running = False

        if self.pubsub:
            try:
                self.pubsub.unsubscribe()
                self.pubsub.close()
            except Exception as e:
                logger.error('Error closing Pub/Sub connection: %s', e)

        if self.listener_thread and self.listener_thread.is_alive():
            self.listener_thread.join(timeout=5)
            if self.listener_thread.is_alive():
                logger.warning('Pub/Sub listener thread did not stop gracefully')

        logger.info('Pub/Sub listener stopped')
