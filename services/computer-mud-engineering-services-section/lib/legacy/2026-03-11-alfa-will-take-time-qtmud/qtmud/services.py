import importlib
import os
import select
import socket
import types
from inspect import getmembers, isfunction, isclass

import qtmud.thing
import qtmud.cmds

class MUDSocket(object):
    """ This class handles qtMUD's MUD socket server service.
    
        .. versionadded:: 0.0.2
    """
    def __init__(self, qtmud):
        self.__name__ = 'MUDSocket'
        self.qtmud = qtmud
        self.log = self.qtmud.log.getChild('services.'+self.__name__)
        self.sockets = dict()
        self.address_config = dict()
        self.logging_in = set()
        self.clients = dict()
        self.connections = list()

    def load(self):
        """ This method loads the MUDSocket service into the qtMUD engine.

            .. versionadded:: 0.1.0
        """
        log = self.log.getChild('load()')
        log.debug('Loading the MUDSocket service.')
        try:
            self.address_config['ipv4'] = (os.environ.get('QTMUD_SERVICE_MUDSOCKET_IPV4_HOSTNAME',
                                                          socket.gethostname()),
                                           os.environ.get('QTMUD_SERVICE_MUDSOCKET_IPV4_PORT'))
            self.address_config['ipv6'] = (os.environ.get('QTMUD_SERVICE_MUDSOCKET_IPV6_HOSTNAME',
                                                          socket.gethostname()),
                                           os.environ.get('QTMUD_SERVICE_MUDSOCKET_IPV6_PORT'))
            if None in self.address_config['ipv4']:
                log.warning('The following IPv4 hostname/port configuration is incorrect: %s', self.address_config['ipv4'])
            if None in self.address_config['ipv6']:
                log.warning('The following IPv6 hostname/port configuration is incorrect: %s', self.address_config['ipv6'])
        except Exception as err:
            log.warning('%s', err)
        log.debug('Loaded MUDSocket service. IPv4 hostname port is %s and IPv6 hostname/port is %s', self.address_config['ipv4'], self.address_config['ipv6'])
        return

        
    def close_sockets(self):
        self.ipv4_socket.close()
        self.ipv6_socket.close()
        return True

    def get_socket_by_thing(self, thing):
        _socket = None
        for s in self.clients:
            if self.clients[s] == thing:
                _socket = s
        return _socket

    def replace_client_object(self, client, obj):
        self.clients[self.get_socket_by_thing(client)] = obj

    def bind_ipv4(self, address):
        log = self.log.getChild('bind_ipv4()')
        log.debug('Binding %s', address)
        try:
            try:
                socket_name = 'ipv4_'+address[0]+'_'+address[1]
                log.debug('Creating new socket "%s"', socket_name)
                self.sockets[socket_name] = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock = self.sockets[socket_name]
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                try:
                    log.debug('Binding %s to %s.', socket_name, address)
                    sock.bind((address[0], int(address[1])))
                    try:
                        log.debug('Making %s listen.', socket_name)
                        sock.listen(5)
                        self.connections.append(sock)
                        log.debug('Connections are now: %s', '{}'.format(self.connections))
                    except Exception as err:
                        log.warning('Failed to make %s listen: %s', socket_name, err, exc_info=True)
                        self.unbind(socket_name)
                except Exception as err:
                    log.warning('Failed to bind %s: %s', socket_name, err, exc_info=True)
            except Exception as err:
                log.warning('Failed to create new socket for %s: %s', address, err, exc_info=True)
        except Exception as err:
            log.warning('Failed to bind %s: %s', address, err, exc_info=True)
        
    def start(self, ipv4_address=None, ipv6_address=None):
        log = self.log.getChild('start()')
        log.debug('Starting MUDSocket service.')
        if not None in self.address_config['ipv4']:
            self.bind_ipv4(self.address_config['ipv4'])

    def unbind(self, socket_name):
        log = self.log.getChild('unbind()')
        log.debug('Unbinding %s.', socket_name)
        try:
            self.sockets[socket_name].shutdown(socket.SHUT_RDWR)
        except Exception as err:
            log.warning('Failed to unbind %s: %s', socket_name, err)

    
    def shutdown(self):
        log = self.log.getChild('shutdown()')
        log.debug('Shutting down the MUDSocket service.')
        for sock in self.sockets:
            self.unbind(sock)

    def accept_connection(self, conn):
        log = self.log.getChild('accept_connection()')
        log.debug('Accepting connection from: %s', conn)
        new_conn, addr = conn.accept()
        log.debug('Accepted connection from %s', conn)
        try:
            log.debug('%s', self.qtmud.loaded_services)
            try:
                new_client = self.qtmud.loaded_services['ClientUtilities'].new_client()
                log.debug('Created %s for %s.', new_client, conn)
            except KeyError as err:
                log.warning('Client Utilities service isn\'t loaded, assigning the connection a generic Thing.')
                try:
                    new_client = self.qtmud.new_thing()
                    log.debug('Created %s for %s.', new_client, conn)
                except Exception as err:
                    log.error('Failed to create a thing for the %s: %s.', conn, err, exc_info=True)
                    return False
            new_client.update({'addr': addr, 'send_buffer' : '', 'recv_buffer': ''})
            self.connections.append(new_conn)
            self.clients[conn] = new_client
            new_client.input_parser = 'mudsocket_login_parser'
            self.qtmud.schedule('send', recipient=new_client, text='Raaaaaar')
        except Exception as err:
            log.warning('Failed to create new client for %s: %s', conn, err, exc_info=True)

            
    def tick(self):
        log = self.log.getChild('tick()')
        read, write, error = select.select(self.connections, [conn for conn, client in self.clients.items() if client.send_buffer != ''], [], 0)
        if read:
            for conn in read:
                for sock in self.sockets:
                    log.debug('Sock: %s', sock)
                    if conn is self.sockets[sock]:
                        self.accept_connection(conn)
                    else:
                        try:
                            data = conn.recv(1024)
                        except ConnectionResetError as err:
                            log.debug('Lost connection %s: %s', conn, err, exc_info=True)
                            mudsocket.clients.pop(socket)
                            mudsocket.connections.remove(socket)

class ClientUtilities(object):
    def __init__(self, qtmud):
        self.__name__ = 'ClientUtilities'
        self.default_commands = importlib.import_module('qtmud.cmds')
        self.qtmud = qtmud
        self.log = self.qtmud.log.getChild(__name__)
        self.client_template = Client
        self.subscriptions = None

    def new_client(self):
        log = self.log.getChild('new_client()')
        new_client = self.client_template(self.qtmud)
        log.debug('Creating a new client; %s', new_client)
        return self.client_template(self.qtmud)

class Client(qtmud.thing.Thing):
    """ The thing which represents a client within qtmud.
    """

    def __init__(self, qtmud, **kwargs):
        super(Client, self).__init__(**kwargs)
        self.qtmud = qtmud
        self.addr = tuple()
        """ The client's address, represented by IP and port.
            .. warning:: Probably broken if you try and connect through IPv6
        """
        self.commands = {}
        """ A dict where keys will be the names of methods in :mod:`qtmud.cmds`
        and the value will be a pointer to that method.
        """
        for command, function in [m for m in getmembers(self.qtmud.loaded_services['ClientUtilities'].default_commands) if
                                  isfunction(m[1])]:
            self.commands[command] = types.MethodType(function, self)
        self.input_parser = 'client_command_parser'
        """ The subscription which will be called when this client inputs a
        command. If you wish to overwrite the client's default command
        parser, you'll need to overwrite this."""
        self.send_buffer = str()
        """ The string representing data the client has received. Usually
        emptied each :func:`tick <qtmud.tick>` by
        :class:`MUDSocket <qtmud.services.MUDSocket>`"""
        self.recv_buffer = str()
        self.channels = list()
        """ All the :class:`Talker <qtmud.services.Talker>` channels the
        client is listening to. """

            
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
