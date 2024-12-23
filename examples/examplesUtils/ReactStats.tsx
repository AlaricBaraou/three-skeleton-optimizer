import { useThree } from "@react-three/fiber"
import { useEffect } from "react"
import Stats from "./Stats"

export const useReactStats = () => {

    const gl = useThree((state) => state.gl)
    const scene = useThree((state) => state.scene)

    useEffect(() => {

        const stats = Stats(gl)
		gl.domElement.parentElement!.appendChild( stats.dom );

        scene.onBeforeRender = () => stats.begin()
        scene.onAfterRender = () => stats.end()

    }, [gl, scene])

    return null
}