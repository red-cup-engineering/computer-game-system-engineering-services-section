import select
import socket

import qtmud


class MUDSocket(object):
    """ Handles a socket service. """
    def __init__(self):
        self.logging_in = set()
        self.clients = dict()
        self.connections = list()
        self.ip4_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.ip4_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.ip6_socket = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
        self.ip6_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

    def close(self):
        self.ip4_socket.close()
        self.ip6_socket.close()
        return True

    def get_socket_by_thing(self, thing):
        _socket = None
        for s in self.clients:
            if self.clients[s] == thing:
                _socket = s
        return _socket

    def replace_client_object(self, client, object):
        self.clients[self.get_socket_by_thing(client)] = object

    def start(self, ip4_address=None, ip6_address=None):
        if not ip4_address:
            ip4_address = (qtmud.IPv4_HOSTNAME, qtmud.IPv4_MUDPORT)
        if not ip6_address:
            ip6_address = (qtmud.IPv6_HOSTNAME, qtmud.IPv6_MUDPORT)
        if not ip4_address and not ip6_address:
            raise RuntimeWarning('qtmud.services.MUDSocket() didn\'t manage '
                                 'to set an address. Is your configuration '
                                 'file missing?')
        if ip4_address:
            qtmud.log.debug('trying to bind() MUDSocket to address %s',
                            ip4_address)
            try:
                self.ip4_socket.bind(ip4_address)
                self.ip4_socket.listen(5)
                self.connections.append(self.ip4_socket)
                qtmud.log.info('MUDSocket successfully bound to %s', ip4_address)
            except OSError as err:
                qtmud.log.error('MUDSocket failed to bind to %s, error: %s',
                                ip4_address, err)
        if ip6_address:
            qtmud.log.debug('trying to bind() MUDSocket to address %s',
                           ip6_address)
            try:
                self.ip6_socket.bind(ip6_address)
                self.ip6_socket.listen(5)
                self.connections.append(self.ip6_socket)
                qtmud.log.info('MUDSocket successfully bound to %s',
                               ip6_address)
            except OSError as err:
                qtmud.log.error('MUDSocket failed to bind to %s, error: %s',
                                ip6_address, err)
        if len(self.connections) == 0:
            return False
        return True

    def shutdown(self):
        qtmud.log.debug('shutdown() and close() MUDSocket.ip4_socket & '
                        'MUDSocket.ip6_socket')
        self.ip4_socket.shutdown(socket.SHUT_RDWR)
        self.ip6_socket.shutdown(socket.SHUT_RDWR)
        return True

    def tick(self):
        read, write, error = select.select(self.connections,
                                           [conn for conn,
                                            client in self.clients.items() if
                                            client.send_buffer != ''],
                                           [],
                                           0)
        if read:
            for conn in read:
                if conn is self.ip4_socket or conn is self.ip6_socket:
                    new_conn, addr = conn.accept()
                    qtmud.log.debug('new connection accepted from %s', format(addr))
                    client = qtmud.Client()
                    client.update({'addr': addr,
                                   'send_buffer': '',
                                   'recv_buffer': ''})
                    self.connections.append(new_conn)
                    self.clients[new_conn] = client
                    client.input_parser = 'client_login_parser'
                    qtmud.schedule('send',
                                   recipient=client,
                                   text=qtmud.SPLASH)
                else:
                    try:
                        data = conn.recv(1024)
                    except ConnectionResetError as err:
                        qtmud.log.debug('lost connection from: {}:\n'
                                        '{}'.format(self.clients[conn].addr,
                                                    err), exc_info=True)
                        qtmud.schedule('client_disconnect',
                                       client=self.clients[conn])
                        return
                    if data == b'':
                        qtmud.log.debug('disconnected from %s',
                                        format(self.clients[conn].addr))
                        qtmud.schedule('client_disconnect',
                                       client=self.clients[conn])
                    else:
                        client = self.clients[conn]
                        client.recv_buffer += data.decode('utf8', 'ignore')
                        if '\n' in client.recv_buffer:
                            split = client.recv_buffer.rstrip().split('\n', 1)
                            if len(split) == 2:
                                line, client.recv_buffer = split
                            else:
                                line, client.recv_buffer = split[0], ''
                            qtmud.schedule('send', recipient=client,
                                           text='> {}'.format(line))
                            qtmud.schedule('client_input_parser',
                                           client=client, line=line)
        if write:
            for conn in write:
                conn.send(self.clients[conn].send_buffer.encode('utf8'))
                self.clients[conn].send_buffer = ''


class Talker(object):
    """ The Talker service handles the global chat channels. """
    def __init__(self):
        self.channels = dict()
        self.history = dict()
        for channel in ['one', 'debug', 'info', 'warning', 'error', 'critical']:
            self.channels[channel] = list()
            self.history[channel] = list()

    def broadcast(self, channel, speaker, message):
        for listener in self.channels[channel]:
            qtmud.schedule('send',
                           recipient=listener,
                           text='`(`{}`)` {}: {}'.format(channel, speaker,
                                                         message))
        self.history[channel].append('{}: {}'.format(speaker, message))

    def new_channel(self, channel):
        self.channels[channel] = list()
        self.history[channel] = list()
        return True

    def tune_channel(self, client, channel):
        if channel not in self.channels:
            self.new_channel(channel)
        self.channels[channel].append(client)
        client.channels.append(channel)
        qtmud.schedule('send', recipient=client,
                       text='You tune into the {} channel'.format(channel))

    def drop_channel(self, client, channel):
        try:
            self.channels[channel].remove(client)
        except Exception as err:
            qtmud.log.warning('Talker.tune_out() failed: %s', err)
        try:
            client.channels.remove(channel)
        except Exception as err:
            qtmud.log.warning('Talker.tune_out() failed: %s', err)
