import { useState, useEffect } from "react"
const { ipcRenderer } = window.require('electron');

const DEFAULT_PLAYLIST_LIBRARY: string[] = []

export const usePlaylistLibrary = () => {  
    const [playlists,setPlaylists] = useState<string[]>(DEFAULT_PLAYLIST_LIBRARY)
    const [receivedPlaylists,setReceivedPlaylists] = useState<boolean>(true);

    useEffect(() => {
        const getPlaylists = async() => {
            try {
                if (receivedPlaylists) { return }
                const content = await ipcRenderer.invoke('get-playlist-names')
                setPlaylists(content)
                setReceivedPlaylists(true)
            } catch (error) {
                console.error('Error communicating with main process:', error);
            }
        }
        getPlaylists()
    },[receivedPlaylists])
    
    return {playlists,setReceivedPlaylists}
}